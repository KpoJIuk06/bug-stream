package az.bugtrack.security;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import javax.crypto.SecretKey;

import org.springframework.stereotype.Service;

import az.bugtrack.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/** Issues and verifies access tokens (HS256). */
@Service
public class JwtService {

    private static final String ISSUER = "bugtrack";

    private final SecretKey key;
    private final Duration accessTtl;

    public JwtService(AppProperties props) {
        String secret = props.jwt().secret();
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET must be at least 32 bytes long");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTtl = props.jwt().accessTtl();
    }

    public Duration accessTtl() {
        return accessTtl;
    }

    public String issue(AuthUser user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .issuer(ISSUER)
                .subject(user.id().toString())
                .claim("email", user.email())
                .claim("name", user.fullName())
                .claim("role", user.role())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(accessTtl)))
                .signWith(key)
                .compact();
    }

    /** Parses the token; permissions are filled in by {@link JwtAuthFilter}. @throws JwtException if forged or expired */
    public AuthUser parse(String token) {
        Claims c = Jwts.parser()
                .verifyWith(key)
                .requireIssuer(ISSUER)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return new AuthUser(
                UUID.fromString(c.getSubject()),
                c.get("email", String.class),
                c.get("name", String.class),
                c.get("role", String.class),
                null);
    }
}
