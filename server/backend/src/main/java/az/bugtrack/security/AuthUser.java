package az.bugtrack.security;

import java.util.Set;
import java.util.UUID;

/** The signed-in user (from the access token) with the permissions of their role. */
public record AuthUser(UUID id, String email, String fullName, String role, Set<String> permissions) {

    public AuthUser {
        permissions = permissions == null ? Set.of() : Set.copyOf(permissions);
    }

    public boolean has(String permission) {
        return permissions.contains(permission);
    }
}
