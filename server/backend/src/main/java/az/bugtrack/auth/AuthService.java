package az.bugtrack.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import az.bugtrack.access.PermissionService;
import az.bugtrack.auth.AuthDtos.TokenResponse;
import az.bugtrack.common.ApiException;
import az.bugtrack.config.AppProperties;
import az.bugtrack.security.JwtService;
import az.bugtrack.user.UserDto;
import az.bugtrack.user.UserRecord;
import az.bugtrack.user.UserRepository;

/**
 * Sign-in and tokens.
 *  - access  — 15-minute JWT, sent as "Authorization: Bearer ...";
 *  - refresh — random string; the database keeps only its SHA-256.
 *    Every /refresh revokes the old token and issues a new one (rotation).
 *    Re-using a revoked token = probably stolen → all sessions of the user are revoked.
 *
 * Sign-in methods are pluggable (see {@link AuthMethods}):
 *  - password methods ({@link PasswordAuthenticator}): local accounts, then AD / LDAP — asked in order;
 *  - one-time e-mail code ({@link AuthCodeService});
 *  - reset / invitation links set a local password and sign the user in.
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    // the same answer for "no such user" and "wrong password"
    private static final String BAD_CREDENTIALS = "Invalid login or password";

    private final UserRepository users;
    private final RefreshTokenRepository tokens;
    private final JwtService jwt;
    private final PasswordEncoder passwordEncoder;
    private final PermissionService permissions;
    private final List<PasswordAuthenticator> authenticators;
    private final AuthMethods methods;
    private final AuthCodeService codes;
    private final AppProperties props;

    public AuthService(UserRepository users, RefreshTokenRepository tokens, JwtService jwt,
                       PasswordEncoder passwordEncoder, PermissionService permissions,
                       List<PasswordAuthenticator> authenticators, AuthMethods methods, AuthCodeService codes,
                       AppProperties props) {
        this.users = users;
        this.tokens = tokens;
        this.jwt = jwt;
        this.passwordEncoder = passwordEncoder;
        this.permissions = permissions;
        this.authenticators = authenticators;
        this.methods = methods;
        this.codes = codes;
        this.props = props;
    }

    @Transactional(noRollbackFor = ApiException.class)
    public TokenResponse login(String login, String password, ClientType client, String userAgent) {
        String typed = login.trim();
        AuthMethods.Effective on = methods.effective();
        UserRecord user = null;
        for (PasswordAuthenticator a : authenticators) {
            boolean enabled = switch (a.method()) {
                case "PASSWORD" -> true;            // checked below: admins keep it as a break-glass
                case "LDAP" -> on.ldap();
                default -> false;
            };
            if (!enabled) {
                continue;
            }
            Optional<UserRecord> found = a.authenticate(typed, password);
            if (found.isPresent()) {
                user = found.get();
                if ("PASSWORD".equals(a.method()) && !methods.passwordAllowedFor(user)) {
                    log.info("Password sign-in refused for {}: the method is turned off", user.email());
                    throw ApiException.unauthorized("METHOD_DISABLED",
                            "Sign-in with a password is turned off — use another sign-in method");
                }
                break;
            }
        }
        if (user == null) {
            throw badCredentials();
        }
        return signIn(user, client, userAgent);
    }

    /** Second step of "Sign in with an e-mail code". */
    @Transactional(noRollbackFor = ApiException.class)
    public TokenResponse loginWithCode(String email, String code, ClientType client, String userAgent) {
        return signIn(codes.verifyLoginCode(email, code), client, userAgent);
    }

    /** Password set from a reset / invitation link: the user is signed in right away. */
    @Transactional
    public TokenResponse completePassword(String token, String newPassword, ClientType client, String userAgent) {
        return signIn(codes.completePassword(token, newPassword), client, userAgent);
    }

    private TokenResponse signIn(UserRecord user, ClientType client, String userAgent) {
        if (!user.active()) {
            throw ApiException.unauthorized("USER_DISABLED", "User is disabled");
        }
        users.touchLastLogin(user.id());
        return issueTokens(user, client, userAgent);
    }

    // noRollbackFor: revoking all sessions on token reuse must be kept although we throw 401
    @Transactional(noRollbackFor = ApiException.class)
    public TokenResponse refresh(String refreshToken, String userAgent) {
        var stored = tokens.findByHashForUpdate(sha256(refreshToken))
                .orElseThrow(() -> ApiException.unauthorized("INVALID_REFRESH_TOKEN", "Invalid refresh token"));

        if (stored.revokedAt() != null) {
            tokens.revokeAllForUser(stored.userId());
            throw ApiException.unauthorized("REFRESH_TOKEN_REUSED", "Refresh token was already used");
        }
        if (stored.expiresAt().isBefore(OffsetDateTime.now())) {
            throw ApiException.unauthorized("REFRESH_TOKEN_EXPIRED", "Refresh token expired");
        }

        UserRecord user = users.findById(stored.userId())
                .filter(UserRecord::active)
                .orElseThrow(() -> ApiException.unauthorized("USER_DISABLED", "User is disabled"));

        tokens.revoke(stored.id());
        return issueTokens(user, stored.client(), userAgent);
    }

    @Transactional
    public void logout(String refreshToken) {
        tokens.findByHashForUpdate(sha256(refreshToken)).ifPresent(t -> tokens.revoke(t.id()));
    }

    @Transactional
    public void changePassword(UUID userId, String currentPassword, String newPassword) {
        UserRecord user = users.findById(userId).orElseThrow(() -> ApiException.notFound("User"));
        if (!user.isLocal()) {
            throw ApiException.badRequest("LDAP_USER", "Change your password in the corporate directory");
        }
        // an account created by an e-mail code has no password yet: it may set one without the "current" one
        if (user.passwordHash() != null
                && (currentPassword == null || !passwordEncoder.matches(currentPassword, user.passwordHash()))) {
            throw ApiException.badRequest("WRONG_PASSWORD", "Current password is incorrect");
        }
        users.updatePassword(userId, passwordEncoder.encode(newPassword));
        tokens.revokeAllForUser(userId);   // sign out everywhere
    }

    /** The signed-in user with their permissions. */
    @Transactional(readOnly = true)
    public UserDto me(UUID userId) {
        UserRecord user = users.findById(userId).orElseThrow(() -> ApiException.notFound("User"));
        return withPermissions(user);
    }

    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void cleanupExpiredTokens() {
        tokens.deleteExpired();
    }

    private TokenResponse issueTokens(UserRecord user, ClientType client, String userAgent) {
        String refresh = randomToken();
        Duration ttl = client == ClientType.EXTENSION
                ? props.jwt().refreshTtlExtension()
                : props.jwt().refreshTtlWeb();
        tokens.insert(user.id(), sha256(refresh), client, truncate(userAgent, 500), OffsetDateTime.now().plus(ttl));

        return new TokenResponse(
                jwt.issue(user.toAuthUser(Set.of())),
                refresh,
                jwt.accessTtl().toSeconds(),
                withPermissions(user));
    }

    private UserDto withPermissions(UserRecord user) {
        List<String> perms = new ArrayList<>(permissions.forRole(user.role()));
        perms.sort(null);
        return user.toDto().withPermissions(perms);
    }

    private static ApiException badCredentials() {
        return ApiException.unauthorized("BAD_CREDENTIALS", BAD_CREDENTIALS);
    }

    private static String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
