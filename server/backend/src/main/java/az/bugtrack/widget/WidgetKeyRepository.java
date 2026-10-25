package az.bugtrack.widget;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class WidgetKeyRepository {

    public record WidgetKey(UUID id, UUID projectId, String name, String keyPrefix, List<String> allowedOrigins,
                            boolean enabled, String createdByName, OffsetDateTime createdAt, OffsetDateTime lastUsedAt) {
    }

    private static final String SELECT = """
            SELECT k.id, k.project_id, k.name, k.key_prefix, k.allowed_origins, k.enabled, u.full_name AS created_by_name,
                   k.created_at, k.last_used_at
              FROM project_widget_key k
              LEFT JOIN app_user u ON u.id = k.created_by
            """;

    private final JdbcClient jdbc;

    public WidgetKeyRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<WidgetKey> listByProject(UUID projectId) {
        return jdbc.sql(SELECT + " WHERE k.project_id = :p ORDER BY k.created_at").param("p", projectId)
                .query(WidgetKeyRepository::map).list();
    }

    public Optional<WidgetKey> find(UUID id) {
        return jdbc.sql(SELECT + " WHERE k.id = :id").param("id", id).query(WidgetKeyRepository::map).optional();
    }

    /** An enabled (not archived) project key by its hash. */
    public Optional<WidgetKey> findActiveByHash(String hash) {
        return jdbc.sql(SELECT + """
                  JOIN project p ON p.id = k.project_id AND p.archived_at IS NULL
                 WHERE k.key_hash = :h AND k.enabled
                """).param("h", hash).query(WidgetKeyRepository::map).optional();
    }

    public UUID insert(UUID projectId, String name, String hash, String prefix, List<String> origins, UUID by) {
        return jdbc.sql("""
                INSERT INTO project_widget_key (project_id, name, key_hash, key_prefix, allowed_origins, created_by)
                VALUES (:p, :name, :hash, :prefix, :origins, :by)
                RETURNING id
                """)
                .param("p", projectId).param("name", name).param("hash", hash).param("prefix", prefix)
                .param("origins", origins.toArray(String[]::new)).param("by", by)
                .query(UUID.class).single();
    }

    public void update(UUID id, String name, List<String> origins, boolean enabled) {
        jdbc.sql("UPDATE project_widget_key SET name = :name, allowed_origins = :origins, enabled = :enabled WHERE id = :id")
                .param("id", id).param("name", name).param("origins", origins.toArray(String[]::new)).param("enabled", enabled)
                .update();
    }

    public void delete(UUID id) {
        jdbc.sql("DELETE FROM project_widget_key WHERE id = :id").param("id", id).update();
    }

    public void touch(UUID id) {
        jdbc.sql("UPDATE project_widget_key SET last_used_at = now() WHERE id = :id").param("id", id).update();
    }

    private static WidgetKey map(ResultSet rs, int n) throws SQLException {
        Array arr = rs.getArray("allowed_origins");
        List<String> origins = arr == null ? List.of() : List.of((String[]) arr.getArray());
        return new WidgetKey(
                rs.getObject("id", UUID.class),
                rs.getObject("project_id", UUID.class),
                rs.getString("name"),
                rs.getString("key_prefix"),
                origins,
                rs.getBoolean("enabled"),
                rs.getString("created_by_name"),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("last_used_at", OffsetDateTime.class));
    }
}
