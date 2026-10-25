package az.bugtrack.user;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import az.bugtrack.access.Permissions;
import az.bugtrack.access.RoleRepository;
import az.bugtrack.auth.RefreshTokenRepository;
import az.bugtrack.common.ApiException;
import az.bugtrack.common.PageDto;

@Service
public class UserService {

    public static final Set<String> LOCALES = Set.of("en", "ru", "az");

    private final UserRepository users;
    private final RoleRepository roles;
    private final RefreshTokenRepository tokens;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository users, RoleRepository roles, RefreshTokenRepository tokens,
                       PasswordEncoder passwordEncoder) {
        this.users = users;
        this.roles = roles;
        this.tokens = tokens;
        this.passwordEncoder = passwordEncoder;
    }

    /** Short list for pickers (@mentions, assignee). */
    @Transactional(readOnly = true)
    public List<UserDto> search(String q, boolean includeInactive) {
        return users.search(q, includeInactive, null, 200, 0).stream().map(UserRecord::toDto).toList();
    }

    /** Paged list for the admin panel. */
    @Transactional(readOnly = true)
    public PageDto<UserDto> page(String q, boolean includeInactive, String role, int page, int size) {
        List<UserDto> items = users.search(q, includeInactive, role, size, page * size).stream()
                .map(UserRecord::toDto).toList();
        return new PageDto<>(items, page, size, users.countSearch(q, includeInactive, role));
    }

    @Transactional(readOnly = true)
    public UserDto get(UUID id) {
        return users.findById(id).orElseThrow(() -> ApiException.notFound("User")).toDto();
    }

    /**
     * Creates a user. LOCAL users need a password or an invitation (they set the password from the e-mailed link); LDAP users sign in with their directory password
     * (an admin can create them in advance to give a role before the first sign-in).
     */
    @Transactional
    public UserDto create(String email, String password, String fullName, String role, String authSource,
                          String username, boolean invite) {
        requireRole(role);
        if (users.findByEmail(email).isPresent()) {
            throw ApiException.conflict("EMAIL_TAKEN", "User with this email already exists");
        }
        boolean ldap = UserRecord.LDAP.equals(authSource);
        if (!ldap && !invite && (password == null || password.length() < 8)) {
            throw ApiException.badRequest("PASSWORD_REQUIRED", "Password must be at least 8 characters");
        }
        String login = username == null || username.isBlank() ? null : username.trim();
        if (login != null && users.findByUsername(login).isPresent()) {
            throw ApiException.conflict("USERNAME_TAKEN", "User with this username already exists");
        }
        UUID id = users.insert(email, ldap || invite ? null : passwordEncoder.encode(password), fullName, role,
                ldap ? UserRecord.LDAP : UserRecord.LOCAL, login, null);
        return get(id);
    }

    @Transactional
    public UserDto update(UUID id, UUID actorId, String fullName, String role, boolean active) {
        UserRecord current = users.findById(id).orElseThrow(() -> ApiException.notFound("User"));
        requireRole(role);
        if (id.equals(actorId) && (!active || !Permissions.ADMIN_ROLE.equals(role))
                && Permissions.ADMIN_ROLE.equals(current.role())) {
            throw ApiException.badRequest("SELF_LOCKOUT", "You cannot disable yourself or remove your own admin role");
        }
        users.update(id, fullName, role, active);
        if (current.active() && !active) {
            tokens.revokeAllForUser(id);   // a disabled user loses all sessions
        }
        return get(id);
    }

    @Transactional
    public void resetPassword(UUID id, String newPassword) {
        UserRecord u = users.findById(id).orElseThrow(() -> ApiException.notFound("User"));
        if (!u.isLocal()) {
            throw ApiException.badRequest("LDAP_USER", "This user signs in with the corporate directory password");
        }
        users.updatePassword(id, passwordEncoder.encode(newPassword));
        tokens.revokeAllForUser(id);
    }

    @Transactional
    public UserDto setLocale(UUID id, String locale) {
        String l = locale == null ? "" : locale.toLowerCase(Locale.ROOT);
        if (!LOCALES.contains(l)) {
            throw ApiException.badRequest("INVALID_LOCALE", "Supported languages: en, ru, az");
        }
        users.updateLocale(id, l);
        return get(id);
    }

    private void requireRole(String role) {
        if (role == null || roles.findByCode(role).isEmpty()) {
            throw ApiException.badRequest("INVALID_ROLE", "Unknown role: " + role);
        }
    }
}
