package az.bugtrack.environment;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class EnvironmentRepository {

    public record EnvironmentDto(UUID id, String code, String name, String color, int sortOrder, boolean active,
                                 long servicesCount, long reportsCount, OffsetDateTime createdAt) {
    }

    private static final String SELECT = """
            SELECT e.id, e.code, e.name, e.color, e.sort_order, e.is_active, e.created_at,
                   (SELECT count(*) FROM project_service s WHERE s.environment = e.code) AS services_count,
                   (SELECT count(*) FROM entity_value v
                      JOIN attribute a ON a.id = v.attribute_id AND a.code = 'environment' AND a.project_id IS NULL
                     WHERE v.v_string = e.code) AS reports_count
              FROM environment e
            """;

    private final JdbcClient jdbc;

    public EnvironmentRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<EnvironmentDto> list(boolean includeInactive) {
        return jdbc.sql(SELECT + " WHERE (:all OR e.is_active) ORDER BY e.sort_order, e.code")
                .param("all", includeInactive)
                .query(EnvironmentRepository::map)
                .list();
    }

    public Optional<EnvironmentDto> findByCode(String code) {
        return jdbc.sql(SELECT + " WHERE e.code = :code")
                .param("code", code)
                .query(EnvironmentRepository::map)
                .optional();
    }

    public boolean isActive(String code) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM environment WHERE code = :code AND is_active)")
                .param("code", code)
                .query(Boolean.class)
                .single();
    }

    public boolean exists(String code) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM environment WHERE code = :code)")
                .param("code", code)
                .query(Boolean.class)
                .single();
    }

    /** Default for new services: TEST if it exists, otherwise the first active environment. */
    public Optional<String> defaultCode() {
        return jdbc.sql("""
                SELECT code FROM environment WHERE is_active
                 ORDER BY (code = 'TEST') DESC, sort_order, code LIMIT 1
                """)
                .query(String.class)
                .optional();
    }

    public void insert(String code, String name, String color, int sortOrder) {
        jdbc.sql("INSERT INTO environment (code, name, color, sort_order) VALUES (:code, :name, :color, :sort)")
                .param("code", code)
                .param("name", name)
                .param("color", color)
                .param("sort", sortOrder)
                .update();
    }

    public void update(String code, String name, String color, int sortOrder, boolean active) {
        jdbc.sql("""
                UPDATE environment SET name = :name, color = :color, sort_order = :sort, is_active = :active
                 WHERE code = :code
                """)
                .param("code", code)
                .param("name", name)
                .param("color", color)
                .param("sort", sortOrder)
                .param("active", active)
                .update();
    }

    public void delete(String code) {
        jdbc.sql("DELETE FROM environment WHERE code = :code").param("code", code).update();
    }

    private static EnvironmentDto map(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new EnvironmentDto(
                rs.getObject("id", UUID.class),
                rs.getString("code"),
                rs.getString("name"),
                rs.getString("color"),
                rs.getInt("sort_order"),
                rs.getBoolean("is_active"),
                rs.getLong("services_count"),
                rs.getLong("reports_count"),
                rs.getObject("created_at", OffsetDateTime.class));
    }
}
