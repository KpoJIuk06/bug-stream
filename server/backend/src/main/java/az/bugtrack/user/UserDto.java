package az.bugtrack.user;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * User as returned by the API. {@code permissions} is filled only for the signed-in user
 * (login, refresh, /api/auth/me) — the frontend shows or hides menu items by it.
 */
public record UserDto(
        UUID id,
        String email,
        String fullName,
        String role,
        String roleName,
        boolean active,
        String authSource,
        String username,
        String locale,
        OffsetDateTime createdAt,
        OffsetDateTime lastLoginAt,
        boolean passwordSet,
        List<String> permissions) {

    public UserDto withPermissions(List<String> perms) {
        return new UserDto(id, email, fullName, role, roleName, active, authSource, username, locale, createdAt,
                lastLoginAt, passwordSet, perms);
    }
}
