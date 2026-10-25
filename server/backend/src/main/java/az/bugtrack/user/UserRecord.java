package az.bugtrack.user;

import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

import az.bugtrack.security.AuthUser;

/** A row of app_user (includes the password hash — never sent to clients). */
public record UserRecord(
        UUID id,
        String email,
        String passwordHash,
        String fullName,
        String role,
        String roleName,
        boolean active,
        String authSource,
        String username,
        String externalId,
        String locale,
        OffsetDateTime createdAt,
        OffsetDateTime lastLoginAt) {

    public static final String LOCAL = "LOCAL";
    public static final String LDAP = "LDAP";

    public AuthUser toAuthUser(Set<String> permissions) {
        return new AuthUser(id, email, fullName, role, permissions);
    }

    public UserDto toDto() {
        return new UserDto(id, email, fullName, role, roleName, active, authSource, username, locale, createdAt,
                lastLoginAt, passwordHash != null, null);
    }

    public boolean isLocal() {
        return LOCAL.equals(authSource);
    }
}
