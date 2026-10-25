package az.bugtrack.access;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

/**
 * Permissions of a role, cached in memory. The cache is cleared whenever a role changes,
 * so a new permission takes effect on the user's next request (no re-login needed).
 */
@Service
public class PermissionService {

    private final RoleRepository roles;
    private final Map<String, Set<String>> cache = new ConcurrentHashMap<>();

    public PermissionService(RoleRepository roles) {
        this.roles = roles;
    }

    public Set<String> forRole(String roleCode) {
        if (roleCode == null) {
            return Set.of();
        }
        return cache.computeIfAbsent(roleCode, code -> Set.copyOf(roles.permissionsOf(code)));
    }

    public void invalidate() {
        cache.clear();
    }
}
