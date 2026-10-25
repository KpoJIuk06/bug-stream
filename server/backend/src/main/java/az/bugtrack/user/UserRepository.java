package az.bugtrack.user;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {

    /** System author of reports sent by the site widget (V8); not a real account. */
    public static final String WIDGET_EMAIL = "widget@adtask.local";

    private static final String SELECT = """
            SELECT u.id, u.email, u.password_hash, u.full_name, u.role, r.name AS role_name, u.is_active,
                   u.auth_source, u.username, u.external_id, u.locale, u.created_at, u.last_login_at
              FROM app_user u
              LEFT JOIN app_role r ON r.code = u.role
            """;

    private final JdbcClient jdbc;

    public UserRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<UserRecord> findById(UUID id) {
        return jdbc.sql(SELECT + " WHERE u.id = :id").param("id", id).query(UserRepository::map).optional();
    }

    public Optional<UserRecord> findByEmail(String email) {
        return jdbc.sql(SELECT + " WHERE lower(u.email) = lower(:email)")
                .param("email", email.trim())
                .query(UserRepository::map)
                .optional();
    }

    public Optional<UserRecord> findByUsername(String username) {
        return jdbc.sql(SELECT + " WHERE lower(u.username) = lower(:username)")
                .param("username", username.trim())
                .query(UserRepository::map)
                .optional();
    }

    /** Search for the users list, @mentions and assignee pickers. */
    public List<UserRecord> search(String q, boolean includeInactive, String role, int limit, int offset) {
        return jdbc.sql(SELECT + """
                 WHERE u.email <> :widget
                   AND (:q = '' OR u.full_name ILIKE '%' || :q || '%' OR u.email ILIKE '%' || :q || '%'
                        OR u.username ILIKE '%' || :q || '%')
                   AND (:all OR u.is_active)
                   AND (:role = '' OR u.role = :role)
                 ORDER BY u.full_name
                 LIMIT :limit OFFSET :offset
                """)
                .param("widget", WIDGET_EMAIL)
                .param("q", q == null ? "" : q.trim())
                .param("all", includeInactive)
                .param("role", role == null ? "" : role)
                .param("limit", limit)
                .param("offset", offset)
                .query(UserRepository::map)
                .list();
    }

    public long countSearch(String q, boolean includeInactive, String role) {
        return jdbc.sql("""
                SELECT count(*) FROM app_user u
                 WHERE u.email <> :widget
                   AND (:q = '' OR u.full_name ILIKE '%' || :q || '%' OR u.email ILIKE '%' || :q || '%'
                        OR u.username ILIKE '%' || :q || '%')
                   AND (:all OR u.is_active)
                   AND (:role = '' OR u.role = :role)
                """)
                .param("widget", WIDGET_EMAIL)
                .param("q", q == null ? "" : q.trim())
                .param("all", includeInactive)
                .param("role", role == null ? "" : role)
                .query(Long.class)
                .single();
    }

    public long count() {
        // the widget's system author does not count, otherwise the first admin would never be created
        return jdbc.sql("SELECT count(*) FROM app_user WHERE email <> :widget")
                .param("widget", WIDGET_EMAIL)
                .query(Long.class)
                .single();
    }

    public UUID insert(String email, String passwordHash, String fullName, String role, String authSource,
                       String username, String externalId) {
        return jdbc.sql("""
                INSERT INTO app_user (email, password_hash, full_name, role, auth_source, username, external_id)
                VALUES (:email, :hash, :name, :role, :source, :username, :externalId)
                RETURNING id
                """)
                .param("email", email.trim())
                .param("hash", passwordHash)
                .param("name", fullName.trim())
                .param("role", role)
                .param("source", authSource)
                .param("username", username)
                .param("externalId", externalId)
                .query(UUID.class)
                .single();
    }

    public void update(UUID id, String fullName, String role, boolean active) {
        jdbc.sql("UPDATE app_user SET full_name = :name, role = :role, is_active = :active WHERE id = :id")
                .param("id", id)
                .param("name", fullName.trim())
                .param("role", role)
                .param("active", active)
                .update();
    }

    /** Data that comes from the directory on every LDAP sign-in. role == null keeps the current role. */
    public void syncLdap(UUID id, String fullName, String username, String externalId, String role) {
        jdbc.sql("""
                UPDATE app_user
                   SET full_name = :name, username = :username, external_id = :externalId,
                       role = coalesce(:role, role), auth_source = 'LDAP'
                 WHERE id = :id
                """)
                .param("id", id)
                .param("name", fullName.trim())
                .param("username", username)
                .param("externalId", externalId)
                .param("role", role)
                .update();
    }

    public void updatePassword(UUID id, String passwordHash) {
        jdbc.sql("UPDATE app_user SET password_hash = :hash WHERE id = :id")
                .param("id", id)
                .param("hash", passwordHash)
                .update();
    }

    public void updateLocale(UUID id, String locale) {
        jdbc.sql("UPDATE app_user SET locale = :locale WHERE id = :id")
                .param("id", id)
                .param("locale", locale)
                .update();
    }

    public void touchLastLogin(UUID id) {
        jdbc.sql("UPDATE app_user SET last_login_at = now() WHERE id = :id")
                .param("id", id)
                .update();
    }

    private static UserRecord map(ResultSet rs, int row) throws SQLException {
        return new UserRecord(
                rs.getObject("id", UUID.class),
                rs.getString("email"),
                rs.getString("password_hash"),
                rs.getString("full_name"),
                rs.getString("role"),
                rs.getString("role_name"),
                rs.getBoolean("is_active"),
                rs.getString("auth_source"),
                rs.getString("username"),
                rs.getString("external_id"),
                rs.getString("locale"),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("last_login_at", OffsetDateTime.class));
    }
}
