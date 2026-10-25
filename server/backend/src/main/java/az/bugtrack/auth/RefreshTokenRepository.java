package az.bugtrack.auth;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class RefreshTokenRepository {

    public record StoredToken(UUID id, UUID userId, ClientType client, OffsetDateTime expiresAt,
                              OffsetDateTime revokedAt) {
    }

    private final JdbcClient jdbc;

    public RefreshTokenRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(UUID userId, String tokenHash, ClientType client, String userAgent, OffsetDateTime expiresAt) {
        jdbc.sql("""
                INSERT INTO refresh_token (user_id, token_hash, client, user_agent, expires_at)
                VALUES (:userId, :hash, :client, :ua, :exp)
                """)
                .param("userId", userId)
                .param("hash", tokenHash)
                .param("client", client.name())
                .param("ua", userAgent)
                .param("exp", expiresAt)
                .update();
    }

    /** Finds a token by hash, including revoked ones (needed to detect reuse). */
    public Optional<StoredToken> findByHashForUpdate(String tokenHash) {
        return jdbc.sql("""
                SELECT id, user_id, client, expires_at, revoked_at
                  FROM refresh_token
                 WHERE token_hash = :hash
                   FOR UPDATE
                """)
                .param("hash", tokenHash)
                .query((rs, n) -> new StoredToken(
                        rs.getObject("id", UUID.class),
                        rs.getObject("user_id", UUID.class),
                        ClientType.valueOf(rs.getString("client")),
                        rs.getObject("expires_at", OffsetDateTime.class),
                        rs.getObject("revoked_at", OffsetDateTime.class)))
                .optional();
    }

    public void revoke(UUID id) {
        jdbc.sql("UPDATE refresh_token SET revoked_at = now() WHERE id = :id AND revoked_at IS NULL")
                .param("id", id)
                .update();
    }

    public void revokeAllForUser(UUID userId) {
        jdbc.sql("UPDATE refresh_token SET revoked_at = now() WHERE user_id = :userId AND revoked_at IS NULL")
                .param("userId", userId)
                .update();
    }

    /** Removes old rows (called on a schedule). */
    public int deleteExpired() {
        return jdbc.sql("DELETE FROM refresh_token WHERE expires_at < now() - interval '30 days'").update();
    }
}
