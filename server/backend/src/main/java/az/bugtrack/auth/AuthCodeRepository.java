package az.bugtrack.auth;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** One-time e-mail codes and links (table auth_code). Only HMACs are stored. */
@Repository
public class AuthCodeRepository {

    public record Code(UUID id, String purpose, String email, UUID userId, String codeHash, int attempts,
                       OffsetDateTime expiresAt) {
    }

    private static final String COLUMNS = "id, purpose, email, user_id, code_hash, attempts, expires_at";

    private final JdbcClient jdbc;

    public AuthCodeRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(String purpose, String email, UUID userId, String codeHash, OffsetDateTime expiresAt, String ip) {
        jdbc.sql("""
                INSERT INTO auth_code (purpose, email, user_id, code_hash, expires_at, ip)
                VALUES (:purpose, lower(:email), :userId, :hash, :expires, :ip)
                """)
                .param("purpose", purpose).param("email", email).param("userId", userId).param("hash", codeHash)
                .param("expires", expiresAt).param("ip", ip)
                .update();
    }

    /** The newest unused, unexpired code of this purpose for the address (locked for the check). */
    public Optional<Code> latestActive(String purpose, String email) {
        return jdbc.sql("SELECT " + COLUMNS + """
                  FROM auth_code
                 WHERE purpose = :purpose AND lower(email) = lower(:email) AND used_at IS NULL AND expires_at > now()
                 ORDER BY created_at DESC LIMIT 1
                 FOR UPDATE
                """)
                .param("purpose", purpose).param("email", email)
                .query(AuthCodeRepository::map)
                .optional();
    }

    /** A link (RESET / INVITE) by its token hash; unused and unexpired. */
    public Optional<Code> activeLink(String codeHash, boolean lock) {
        return jdbc.sql("SELECT " + COLUMNS + """
                  FROM auth_code
                 WHERE code_hash = :hash AND purpose IN ('RESET', 'INVITE') AND used_at IS NULL AND expires_at > now()
                """ + (lock ? " FOR UPDATE" : ""))
                .param("hash", codeHash)
                .query(AuthCodeRepository::map)
                .optional();
    }

    public void addAttempt(UUID id) {
        jdbc.sql("UPDATE auth_code SET attempts = attempts + 1 WHERE id = :id").param("id", id).update();
    }

    public void markUsed(UUID id) {
        jdbc.sql("UPDATE auth_code SET used_at = now() WHERE id = :id").param("id", id).update();
    }

    /** A new code / link replaces the previous ones of the same kind. */
    public void expirePrevious(String purpose, String email) {
        jdbc.sql("""
                UPDATE auth_code SET used_at = now()
                 WHERE purpose = :purpose AND lower(email) = lower(:email) AND used_at IS NULL
                """)
                .param("purpose", purpose).param("email", email)
                .update();
    }

    /** After a password is set: every other open reset / invitation link of the user stops working. */
    public void expireLinksOfUser(UUID userId) {
        jdbc.sql("UPDATE auth_code SET used_at = now() WHERE user_id = :id AND purpose IN ('RESET', 'INVITE') AND used_at IS NULL")
                .param("id", userId)
                .update();
    }

    public int countForEmailSince(String email, OffsetDateTime since) {
        return jdbc.sql("SELECT count(*) FROM auth_code WHERE lower(email) = lower(:email) AND created_at > :since")
                .param("email", email).param("since", since)
                .query(Integer.class).single();
    }

    public int countForIpSince(String ip, OffsetDateTime since) {
        return jdbc.sql("SELECT count(*) FROM auth_code WHERE ip = :ip AND created_at > :since")
                .param("ip", ip).param("since", since)
                .query(Integer.class).single();
    }

    public int deleteOld() {
        return jdbc.sql("DELETE FROM auth_code WHERE expires_at < now() - interval '7 days'").update();
    }

    private static Code map(java.sql.ResultSet rs, int i) throws java.sql.SQLException {
        return new Code(rs.getObject("id", UUID.class), rs.getString("purpose"), rs.getString("email"),
                rs.getObject("user_id", UUID.class), rs.getString("code_hash"), rs.getInt("attempts"),
                rs.getObject("expires_at", OffsetDateTime.class));
    }
}
