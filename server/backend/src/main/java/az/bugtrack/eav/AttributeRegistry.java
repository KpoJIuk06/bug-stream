package az.bugtrack.eav;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import az.bugtrack.eav.AttributeDef.DataType;

/**
 * Reads EAV field definitions. The table is small, so it is read from the database on every request —
 * no cache needed, and new custom fields are visible at once.
 */
@Component
public class AttributeRegistry {

    private final JdbcClient jdbc;

    public AttributeRegistry(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Common fields of the type + custom fields of the project (when projectId is set). */
    public List<AttributeDef> forType(String entityType, UUID projectId) {
        return jdbc.sql("""
                SELECT a.id, t.code AS entity_type, a.project_id, a.code, a.label, a.data_type, a.is_required,
                       a.is_multi, a.is_filterable, a.is_system, a.sort_order,
                       ARRAY(SELECT jsonb_array_elements_text(a.options)) AS options
                  FROM attribute a
                  JOIN entity_type t ON t.id = a.entity_type_id
                 WHERE t.code = :type
                   AND (a.project_id IS NULL OR a.project_id = :projectId)
                 ORDER BY a.sort_order, a.code
                """)
                .param("type", entityType)
                .param("projectId", projectId)
                .query(AttributeRegistry::map)
                .list();
    }

    /** Fields by code; a project's custom field overrides a common one with the same code. */
    public Map<String, AttributeDef> byCode(String entityType, UUID projectId) {
        Map<String, AttributeDef> result = new LinkedHashMap<>();
        for (AttributeDef a : forType(entityType, projectId)) {
            if (a.projectId() != null || !result.containsKey(a.code())) {
                result.put(a.code(), a);
            }
        }
        return result;
    }

    public Optional<AttributeDef> find(String entityType, UUID projectId, String code) {
        return Optional.ofNullable(byCode(entityType, projectId).get(code));
    }

    public UUID entityTypeId(String code) {
        return jdbc.sql("SELECT id FROM entity_type WHERE code = :code")
                .param("code", code)
                .query(UUID.class)
                .single();
    }

    private static AttributeDef map(ResultSet rs, int row) throws SQLException {
        Array arr = rs.getArray("options");
        List<String> options = null;
        if (arr != null) {
            Object[] values = (Object[]) arr.getArray();
            if (values.length > 0) {
                options = Arrays.stream(values).map(String::valueOf).toList();
            }
        }
        return new AttributeDef(
                rs.getObject("id", UUID.class),
                rs.getString("entity_type"),
                rs.getObject("project_id", UUID.class),
                rs.getString("code"),
                rs.getString("label"),
                DataType.valueOf(rs.getString("data_type")),
                rs.getBoolean("is_required"),
                rs.getBoolean("is_multi"),
                rs.getBoolean("is_filterable"),
                rs.getBoolean("is_system"),
                options,
                rs.getInt("sort_order"));
    }
}
