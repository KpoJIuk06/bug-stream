package az.bugtrack.access;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class RoleRepository {

    public record PermissionRow(String code, String category) {
    }

    public record RoleRow(UUID id, String code, String name, String description, boolean system,
                          List<String> permissions, long usersCount, OffsetDateTime createdAt) {
    }

    private static final String SELECT = """
            SELECT r.id, r.code, r.name, r.description, r.is_system, r.created_at,
                   coalesce((SELECT array_agg(rp.permission_code ORDER BY rp.permission_code)
                               FROM role_permission rp WHERE rp.role_id = r.id), '{}') AS permissions,
                   (SELECT count(*) FROM app_user u WHERE u.role = r.code
                      AND u.email <> 'widget@adtask.local') AS users_count
              FROM app_role r
            """;

    private final JdbcClient jdbc;

    public RoleRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<PermissionRow> permissions() {
        return jdbc.sql("SELECT code, category FROM permission ORDER BY category, sort_order, code")
                .query((rs, i) -> new PermissionRow(rs.getString("code"), rs.getString("category")))
                .list();
    }

    public List<RoleRow> list() {
        return jdbc.sql(SELECT + " ORDER BY r.is_system DESC, r.created_at").query(RoleRepository::map).list();
    }

    public Optional<RoleRow> findByCode(String code) {
        return jdbc.sql(SELECT + " WHERE r.code = :code").param("code", code).query(RoleRepository::map).optional();
    }

    public Optional<RoleRow> find(UUID id) {
        return jdbc.sql(SELECT + " WHERE r.id = :id").param("id", id).query(RoleRepository::map).optional();
    }

    public List<String> permissionsOf(String roleCode) {
        return jdbc.sql("""
                SELECT rp.permission_code FROM role_permission rp
                  JOIN app_role r ON r.id = rp.role_id
                 WHERE r.code = :code
                """)
                .param("code", roleCode)
                .query(String.class)
                .list();
    }

    public UUID insert(String code, String name, String description) {
        return jdbc.sql("INSERT INTO app_role (code, name, description) VALUES (:code, :name, :description) RETURNING id")
                .param("code", code)
                .param("name", name)
                .param("description", description)
                .query(UUID.class)
                .single();
    }

    public void update(UUID id, String name, String description) {
        jdbc.sql("UPDATE app_role SET name = :name, description = :description WHERE id = :id")
                .param("id", id)
                .param("name", name)
                .param("description", description)
                .update();
    }

    /** Replaces the role's permissions; only rows that really change are touched (cleaner audit log). */
    public void setPermissions(UUID roleId, Collection<String> permissions) {
        String[] codes = permissions.toArray(String[]::new);
        jdbc.sql("DELETE FROM role_permission WHERE role_id = :id AND NOT (permission_code = ANY(:codes))")
                .param("id", roleId)
                .param("codes", codes)
                .update();
        jdbc.sql("""
                INSERT INTO role_permission (role_id, permission_code)
                SELECT :id, c FROM unnest(:codes) AS c
                ON CONFLICT DO NOTHING
                """)
                .param("id", roleId)
                .param("codes", codes)
                .update();
    }

    public void delete(UUID id) {
        jdbc.sql("DELETE FROM app_role WHERE id = :id").param("id", id).update();
    }

    private static RoleRow map(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        String[] perms = (String[]) rs.getArray("permissions").getArray();
        return new RoleRow(
                rs.getObject("id", UUID.class),
                rs.getString("code"),
                rs.getString("name"),
                rs.getString("description"),
                rs.getBoolean("is_system"),
                new ArrayList<>(Arrays.asList(perms)),
                rs.getLong("users_count"),
                rs.getObject("created_at", OffsetDateTime.class));
    }
}
