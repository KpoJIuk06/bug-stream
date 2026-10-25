package az.bugtrack.eav;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Low-level work with entity / entity_value.
 * Values are already converted to the right Java type by ValueConverter.
 * The change history is written by triggers automatically.
 */
@Repository
public class EavRepository {

    public record EntityRow(UUID id, String type, UUID parentId, UUID projectId, UUID serviceId, UUID createdBy,
                            OffsetDateTime createdAt, OffsetDateTime updatedAt, OffsetDateTime deletedAt) {
    }

    private final JdbcClient jdbc;

    public EavRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ----------------------------- entities -----------------------------

    public UUID createEntity(UUID entityTypeId, UUID parentId, UUID projectId, UUID serviceId, UUID createdBy) {
        return jdbc.sql("""
                INSERT INTO entity (entity_type_id, parent_id, project_id, service_id, created_by)
                VALUES (:type, :parent, :project, :service, :by)
                RETURNING id
                """)
                .param("type", entityTypeId)
                .param("parent", parentId)
                .param("project", projectId)
                .param("service", serviceId)
                .param("by", createdBy)
                .query(UUID.class)
                .single();
    }

    public Optional<EntityRow> find(UUID id) {
        return jdbc.sql("""
                SELECT e.id, t.code AS type, e.parent_id, e.project_id, e.service_id, e.created_by,
                       e.created_at, e.updated_at, e.deleted_at
                  FROM entity e
                  JOIN entity_type t ON t.id = e.entity_type_id
                 WHERE e.id = :id
                """)
                .param("id", id)
                .query((rs, n) -> new EntityRow(
                        rs.getObject("id", UUID.class),
                        rs.getString("type"),
                        rs.getObject("parent_id", UUID.class),
                        rs.getObject("project_id", UUID.class),
                        rs.getObject("service_id", UUID.class),
                        rs.getObject("created_by", UUID.class),
                        rs.getObject("created_at", OffsetDateTime.class),
                        rs.getObject("updated_at", OffsetDateTime.class),
                        rs.getObject("deleted_at", OffsetDateTime.class)))
                .optional();
    }

    /** Marks an entity as changed (updated_at) — after editing values. */
    public void touch(UUID id) {
        jdbc.sql("UPDATE entity SET updated_at = now() WHERE id = :id").param("id", id).update();
    }

    public void setDeleted(UUID id, boolean deleted) {
        jdbc.sql("UPDATE entity SET deleted_at = CASE WHEN :deleted THEN now() ELSE NULL END WHERE id = :id")
                .param("id", id)
                .param("deleted", deleted)
                .update();
    }

    public void move(UUID id, UUID projectId, UUID serviceId) {
        jdbc.sql("UPDATE entity SET project_id = :p, service_id = :s WHERE id = :id")
                .param("id", id)
                .param("p", projectId)
                .param("s", serviceId)
                .update();
    }

    // ----------------------------- values -----------------------------

    /** Sets a single value; null clears the field. */
    public void setSingle(UUID entityId, AttributeDef a, Object value) {
        Optional<UUID> existing = jdbc.sql("""
                SELECT id FROM entity_value WHERE entity_id = :e AND attribute_id = :a AND idx = 0
                """)
                .param("e", entityId)
                .param("a", a.id())
                .query(UUID.class)
                .optional();

        if (value == null) {
            existing.ifPresent(id -> jdbc.sql("DELETE FROM entity_value WHERE id = :id").param("id", id).update());
        } else if (existing.isPresent()) {
            jdbc.sql("UPDATE entity_value SET " + a.column() + " = :v WHERE id = :id")
                    .param("id", existing.get())
                    .param("v", value)
                    .update();
        } else {
            insertValue(entityId, a, 0, value);
        }
    }

    /** Replaces the values of an is_multi field (does nothing when the list is unchanged). */
    public void setMulti(UUID entityId, AttributeDef a, List<Object> values) {
        List<Object> current = readList(entityId, a);
        if (current.equals(values)) {
            return;
        }
        jdbc.sql("DELETE FROM entity_value WHERE entity_id = :e AND attribute_id = :a")
                .param("e", entityId)
                .param("a", a.id())
                .update();
        for (int i = 0; i < values.size(); i++) {
            insertValue(entityId, a, i, values.get(i));
        }
    }

    /** Current single value of a field (in the column's Java type) or null. */
    public Object readSingle(UUID entityId, AttributeDef a) {
        List<Object> list = readList(entityId, a);
        return list.isEmpty() ? null : list.getFirst();
    }

    public List<Object> readList(UUID entityId, AttributeDef a) {
        return jdbc.sql("SELECT " + a.column() + " AS v FROM entity_value"
                        + " WHERE entity_id = :e AND attribute_id = :a ORDER BY idx")
                .param("e", entityId)
                .param("a", a.id())
                .query((rs, n) -> normalize(a, rs.getObject("v")))
                .list();
    }

    /**
     * All values of an entity as a JSON object {"code": value | [values]} — built by PostgreSQL,
     * returned to the frontend as is.
     */
    public String valuesJson(UUID entityId) {
        return jdbc.sql("""
                SELECT coalesce(jsonb_object_agg(code, CASE WHEN is_multi THEN vals ELSE vals -> 0 END), '{}'::jsonb)::text
                  FROM (SELECT a.code, a.is_multi, jsonb_agg(entity_value_json(v) ORDER BY v.idx) AS vals
                          FROM entity_value v
                          JOIN attribute a ON a.id = v.attribute_id
                         WHERE v.entity_id = :e
                         GROUP BY a.code, a.is_multi) t
                """)
                .param("e", entityId)
                .query(String.class)
                .single();
    }

    /** String values of one field for a set of entities (e.g. tags for a list page). */
    public Map<UUID, List<String>> stringValues(Collection<UUID> entityIds, String attributeCode) {
        Map<UUID, List<String>> result = new HashMap<>();
        if (entityIds.isEmpty()) {
            return result;
        }
        jdbc.sql("""
                SELECT v.entity_id, v.v_string
                  FROM entity_value v
                  JOIN attribute a ON a.id = v.attribute_id AND a.code = :code AND a.project_id IS NULL
                 WHERE v.entity_id IN (:ids) AND v.v_string IS NOT NULL
                 ORDER BY v.idx
                """)
                .param("code", attributeCode)
                .param("ids", entityIds)
                .query((rs, n) -> {
                    result.computeIfAbsent(rs.getObject("entity_id", UUID.class), k -> new ArrayList<>())
                            .add(rs.getString("v_string"));
                    return null;
                })
                .list();
        return result;
    }

    // ------------------------------------------------------------------

    private void insertValue(UUID entityId, AttributeDef a, int idx, Object value) {
        jdbc.sql("INSERT INTO entity_value (entity_id, attribute_id, idx, " + a.column() + ")"
                        + " VALUES (:e, :a, :idx, :v)")
                .param("e", entityId)
                .param("a", a.id())
                .param("idx", idx)
                .param("v", value)
                .update();
    }

    /** Brings a JDBC value to the type ValueConverter produces (to compare lists). */
    private static Object normalize(AttributeDef a, Object v) {
        if (v == null) {
            return null;
        }
        return switch (a.dataType()) {
            case INT -> ((Number) v).longValue();
            case DECIMAL -> new java.math.BigDecimal(v.toString());
            default -> Objects.requireNonNull(v);
        };
    }
}
