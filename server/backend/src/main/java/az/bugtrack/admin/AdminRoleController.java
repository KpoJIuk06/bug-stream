package az.bugtrack.admin;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import az.bugtrack.access.PermissionService;
import az.bugtrack.access.Permissions;
import az.bugtrack.access.RoleRepository;
import az.bugtrack.access.RoleRepository.PermissionRow;
import az.bugtrack.access.RoleRepository.RoleRow;
import az.bugtrack.common.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Admin panel → Roles. Everyone with admin.access can read roles (needed for the user form);
 * changing them needs role.manage. The ADMIN role always keeps every permission.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminRoleController {

    public record RoleRequest(
            @Pattern(regexp = "^[A-Za-z][A-Za-z0-9_]{1,29}$") String code,
            @NotBlank @Size(max = 100) String name,
            @Size(max = 500) String description,
            @NotNull List<String> permissions) {
    }

    private final RoleRepository roles;
    private final PermissionService permissionService;

    public AdminRoleController(RoleRepository roles, PermissionService permissionService) {
        this.roles = roles;
        this.permissionService = permissionService;
    }

    @GetMapping("/permissions")
    public List<PermissionRow> permissions() {
        return roles.permissions();
    }

    @GetMapping("/roles")
    public List<RoleRow> list() {
        return roles.list();
    }

    @PostMapping("/roles")
    @PreAuthorize("hasAuthority('role.manage')")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public RoleRow create(@Valid @RequestBody RoleRequest req) {
        if (req.code() == null) {
            throw ApiException.badRequest("CODE_REQUIRED", "Role code is required");
        }
        String code = req.code().toUpperCase(Locale.ROOT);
        if (roles.findByCode(code).isPresent()) {
            throw ApiException.conflict("ROLE_EXISTS", "Role " + code + " already exists");
        }
        UUID id = roles.insert(code, req.name().trim(), blankToNull(req.description()));
        roles.setPermissions(id, validPermissions(req.permissions()));
        permissionService.invalidate();
        return roles.find(id).orElseThrow();
    }

    @PatchMapping("/roles/{id}")
    @PreAuthorize("hasAuthority('role.manage')")
    @Transactional
    public RoleRow update(@PathVariable UUID id, @Valid @RequestBody RoleRequest req) {
        RoleRow role = roles.find(id).orElseThrow(() -> ApiException.notFound("Role"));
        roles.update(id, req.name().trim(), blankToNull(req.description()));
        Set<String> perms = validPermissions(req.permissions());
        if (Permissions.ADMIN_ROLE.equals(role.code())) {
            perms = roles.permissions().stream().map(PermissionRow::code).collect(Collectors.toSet());
        }
        roles.setPermissions(id, perms);
        permissionService.invalidate();
        return roles.find(id).orElseThrow();
    }

    @DeleteMapping("/roles/{id}")
    @PreAuthorize("hasAuthority('role.manage')")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        RoleRow role = roles.find(id).orElseThrow(() -> ApiException.notFound("Role"));
        if (role.system()) {
            throw ApiException.badRequest("SYSTEM_ROLE", "System roles cannot be deleted");
        }
        if (role.usersCount() > 0) {
            throw ApiException.conflict("ROLE_IN_USE", "Move the users to another role first");
        }
        roles.delete(id);
        permissionService.invalidate();
        return ResponseEntity.noContent().build();
    }

    private Set<String> validPermissions(List<String> requested) {
        Set<String> known = roles.permissions().stream().map(PermissionRow::code).collect(Collectors.toSet());
        Set<String> result = new HashSet<>();
        for (String p : requested) {
            if (!known.contains(p)) {
                throw ApiException.badRequest("UNKNOWN_PERMISSION", "Unknown permission: " + p);
            }
            result.add(p);
        }
        return result;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
