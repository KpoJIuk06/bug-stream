package az.bugtrack.admin;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import az.bugtrack.auth.AuthCodeService;
import az.bugtrack.common.PageDto;
import az.bugtrack.security.AuthUser;
import az.bugtrack.user.UserDto;
import az.bugtrack.user.UserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Admin panel → Users. */
@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasAuthority('user.manage')")
public class AdminUserController {

    public record CreateUserRequest(
            @NotBlank @Email @Size(max = 320) String email,
            @Size(max = 128) String password,
            @NotBlank @Size(max = 200) String fullName,
            @NotBlank String role,
            @Pattern(regexp = "LOCAL|LDAP") String authSource,
            @Size(max = 200) String username,
            Boolean invite) {
    }

    public record UpdateUserRequest(
            @NotBlank @Size(max = 200) String fullName,
            @NotBlank String role,
            @NotNull Boolean active) {
    }

    public record ResetPasswordRequest(@NotBlank @Size(min = 8, max = 128) String newPassword) {
    }

    private final UserService service;
    private final AuthCodeService codes;

    public AdminUserController(UserService service, AuthCodeService codes) {
        this.service = service;
        this.codes = codes;
    }

    @GetMapping
    public PageDto<UserDto> list(@RequestParam(defaultValue = "") String q,
                                 @RequestParam(defaultValue = "true") boolean includeInactive,
                                 @RequestParam(required = false) String role,
                                 @RequestParam(defaultValue = "0") int page,
                                 @RequestParam(defaultValue = "25") int size) {
        return service.page(q, includeInactive, role, Math.max(page, 0), Math.clamp(size, 1, 200));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public UserDto create(@Valid @RequestBody CreateUserRequest req) {
        boolean invite = Boolean.TRUE.equals(req.invite()) && !"LDAP".equals(req.authSource());
        UserDto u = service.create(req.email(), invite ? null : req.password(), req.fullName(), req.role(),
                req.authSource() == null ? "LOCAL" : req.authSource(), req.username(), invite);
        if (invite) {
            codes.invite(u.id());   // an SMTP error rolls the new user back
        }
        return u;
    }

    /** E-mails the user a "set your password" link (again). */
    @PostMapping("/{id}/invite")
    public ResponseEntity<Void> invite(@PathVariable UUID id) {
        codes.invite(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}")
    public UserDto update(@PathVariable UUID id, @AuthenticationPrincipal AuthUser me,
                          @Valid @RequestBody UpdateUserRequest req) {
        return service.update(id, me.id(), req.fullName(), req.role(), req.active());
    }

    @PostMapping("/{id}/reset-password")
    public ResponseEntity<Void> resetPassword(@PathVariable UUID id, @Valid @RequestBody ResetPasswordRequest req) {
        service.resetPassword(id, req.newPassword());
        return ResponseEntity.noContent().build();
    }
}
