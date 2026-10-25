package az.bugtrack.auth;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import az.bugtrack.common.ApiException;
import az.bugtrack.config.AppProperties;
import az.bugtrack.mail.MailService;
import az.bugtrack.user.UserRecord;
import az.bugtrack.user.UserRepository;

/**
 * Everything that is proven by access to a mailbox:
 * <ul>
 *   <li>sign-in with a one-time code (6 digits, 10 minutes, 5 attempts, a new code replaces the old one);</li>
 *   <li>"Forgot password?" link for local accounts (1 hour);</li>
 *   <li>invitation link for a new local account: "set your password" (7 days).</li>
 * </ul>
 * The answers never reveal whether an address is registered: the same response and the same timing
 * (e-mails go out in the background) for known and unknown addresses. Limits: 3 requests per address
 * per 15 minutes, 30 per IP per hour. Only an HMAC of a code / link is stored.
 */
@Service
public class AuthCodeService {

    private static final Logger log = LoggerFactory.getLogger(AuthCodeService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    static final int CODE_MINUTES = 10;
    static final int CODE_ATTEMPTS = 5;
    static final int RESET_MINUTES = 60;
    static final int INVITE_DAYS = 7;
    private static final int PER_EMAIL_15_MIN = 3;
    private static final int PER_IP_HOUR = 30;

    /** What the "set password" page shows before the user types. */
    public record LinkInfo(String purpose, String email, String fullName) {
    }

    private final AuthCodeRepository codes;
    private final UserRepository users;
    private final AuthMethods methods;
    private final MailService mail;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenRepository tokens;
    private final AppProperties props;
    private final SecretKeySpec hmacKey;

    public AuthCodeService(AuthCodeRepository codes, UserRepository users, AuthMethods methods, MailService mail,
                           PasswordEncoder passwordEncoder, RefreshTokenRepository tokens, AppProperties props) {
        this.codes = codes;
        this.users = users;
        this.methods = methods;
        this.mail = mail;
        this.passwordEncoder = passwordEncoder;
        this.tokens = tokens;
        this.props = props;
        this.hmacKey = new SecretKeySpec(("auth-codes:" + props.jwt().secret()).getBytes(StandardCharsets.UTF_8),
                "HmacSHA256");
    }

    // ----------------------------- sign-in code -----------------------------

    @Transactional
    public void requestLoginCode(String rawEmail, String locale, String ip) {
        if (!methods.effective().emailCode()) {
            throw methodOff("Sign-in with an e-mail code is turned off");
        }
        String email = normalize(rawEmail);
        rateLimit(email, ip);

        Optional<UserRecord> user = users.findByEmail(email);
        boolean eligible = methods.domainAllowed(email)
                && (user.map(UserRecord::active).orElse(false) || (user.isEmpty() && methods.autoCreate()));
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        codes.expirePrevious("LOGIN", email);
        // the row is written for unknown addresses too, so limits behave the same for everybody
        codes.insert("LOGIN", email, user.map(UserRecord::id).orElse(null),
                eligible ? hash("LOGIN:" + email + ":" + code) : "x:" + randomToken(),
                OffsetDateTime.now().plusMinutes(CODE_MINUTES), ip);
        if (eligible) {
            AuthMails.Mail m = AuthMails.loginCode(user.map(UserRecord::locale).orElse(locale), code, CODE_MINUTES);
            mail.sendLater(email, m.subject(), m.text(), m.html());
        } else {
            log.info("E-mail code requested for {} — not sent (unknown, disabled or domain not allowed)", email);
        }
    }

    /** Checks the code; returns the user (created on the first sign-in when auto-create is on). */
    @Transactional(noRollbackFor = ApiException.class)
    public UserRecord verifyLoginCode(String rawEmail, String rawCode) {
        if (!methods.effective().emailCode()) {
            throw methodOff("Sign-in with an e-mail code is turned off");
        }
        String email = normalize(rawEmail);
        String code = rawCode == null ? "" : rawCode.replaceAll("\\s+", "");
        AuthCodeRepository.Code row = codes.latestActive("LOGIN", email).orElseThrow(AuthCodeService::invalidCode);
        if (row.attempts() >= CODE_ATTEMPTS) {
            throw invalidCode();
        }
        if (!code.matches("\\d{6}") || !constantEquals(row.codeHash(), hash("LOGIN:" + email + ":" + code))) {
            codes.addAttempt(row.id());
            throw invalidCode();
        }
        codes.markUsed(row.id());

        Optional<UserRecord> user = users.findByEmail(email);
        if (user.isEmpty()) {
            if (!methods.autoCreate() || !methods.domainAllowed(email)) {
                throw invalidCode();
            }
            UUID id = users.insert(email, null, nameFromEmail(email), methods.autoCreateRole(), UserRecord.LOCAL, null, null);
            log.info("Created user {} on the first sign-in with an e-mail code", email);
            user = users.findById(id);
        }
        return user.orElseThrow(AuthCodeService::invalidCode);
    }

    // ----------------------------- password reset / invitation -----------------------------

    @Transactional
    public void requestPasswordReset(String rawEmail, String locale, String ip) {
        if (!methods.effective().passwordReset()) {
            throw methodOff("Password reset by e-mail is turned off — ask an administrator");
        }
        String email = normalize(rawEmail);
        rateLimit(email, ip);
        Optional<UserRecord> user = users.findByEmail(email).filter(u -> u.active() && u.isLocal());
        String token = randomToken();
        codes.expirePrevious("RESET", email);
        codes.insert("RESET", email, user.map(UserRecord::id).orElse(null),
                user.isPresent() ? hash("LINK:" + token) : "x:" + randomToken(),
                OffsetDateTime.now().plusMinutes(RESET_MINUTES), ip);
        if (user.isPresent()) {
            AuthMails.Mail m = AuthMails.resetLink(user.get().locale(), email, link(token), RESET_MINUTES);
            mail.sendLater(email, m.subject(), m.text(), m.html());
        } else {
            log.info("Password reset requested for {} — not sent (no active local account)", email);
        }
    }

    /** Sends (or re-sends) the "set your password" link to a local user. Synchronous: the admin sees SMTP errors. */
    @Transactional
    public void invite(UUID userId) {
        UserRecord u = users.findById(userId).orElseThrow(() -> ApiException.notFound("User"));
        if (!u.isLocal()) {
            throw ApiException.badRequest("LDAP_USER", "This user signs in with the corporate directory password");
        }
        if (!u.active()) {
            throw ApiException.badRequest("USER_DISABLED", "The user is disabled");
        }
        if (!mail.isConfigured()) {
            throw ApiException.conflict("MAIL_NOT_CONFIGURED",
                    "E-mail is not configured — set the SMTP server in Administration → E-mail");
        }
        String token = randomToken();
        codes.expirePrevious("INVITE", u.email());
        codes.insert("INVITE", u.email(), u.id(), hash("LINK:" + token),
                OffsetDateTime.now().plus(Duration.ofDays(INVITE_DAYS)), null);
        AuthMails.Mail m = AuthMails.invite(u.locale(), u.fullName(), u.email(), link(token), INVITE_DAYS);
        try {
            mail.send(u.email(), m.subject(), m.text(), m.html());
        } catch (MailService.MailFailure e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "MAIL_FAILED", "The SMTP server refused the e-mail: " + e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public LinkInfo linkInfo(String token) {
        AuthCodeRepository.Code c = codes.activeLink(hash("LINK:" + nn(token)), false).orElseThrow(AuthCodeService::invalidLink);
        UserRecord u = users.findById(c.userId()).filter(UserRecord::active).orElseThrow(AuthCodeService::invalidLink);
        return new LinkInfo(c.purpose(), u.email(), u.fullName());
    }

    /** Sets the password from a reset / invitation link; every session of the user is signed out. */
    @Transactional
    public UserRecord completePassword(String token, String newPassword) {
        if (newPassword == null || newPassword.length() < 8 || newPassword.length() > 128) {
            throw ApiException.badRequest("WEAK_PASSWORD", "Password must be 8–128 characters");
        }
        AuthCodeRepository.Code c = codes.activeLink(hash("LINK:" + nn(token)), true).orElseThrow(AuthCodeService::invalidLink);
        UserRecord u = users.findById(c.userId()).filter(x -> x.active() && x.isLocal()).orElseThrow(AuthCodeService::invalidLink);
        users.updatePassword(u.id(), passwordEncoder.encode(newPassword));
        codes.markUsed(c.id());
        codes.expireLinksOfUser(u.id());
        tokens.revokeAllForUser(u.id());
        return users.findById(u.id()).orElseThrow();
    }

    @Scheduled(cron = "0 40 3 * * *")
    @Transactional
    public void cleanup() {
        codes.deleteOld();
    }

    // ------------------------------------------------------------------

    private void rateLimit(String email, String ip) {
        OffsetDateTime now = OffsetDateTime.now();
        if (ip != null && codes.countForIpSince(ip, now.minusHours(1)) >= PER_IP_HOUR) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_REQUESTS", "Too many requests — try again later");
        }
        if (codes.countForEmailSince(email, now.minusMinutes(15)) >= PER_EMAIL_15_MIN) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_REQUESTS",
                    "Too many e-mails for this address — wait 15 minutes");
        }
    }

    private String link(String token) {
        return props.publicUrl().replaceAll("/+$", "") + "/set-password?token=" + token;
    }

    private String hash(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(hmacKey);
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    private static boolean constantEquals(String a, String b) {
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    static String normalize(String email) {
        String e = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        if (e.length() > 320 || !e.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) {
            throw ApiException.badRequest("INVALID_EMAIL", "Enter a valid e-mail address");
        }
        return e;
    }

    /** "ivan.petrov@example.com" → "Ivan Petrov" (the user can change it later). */
    static String nameFromEmail(String email) {
        String local = email.substring(0, email.indexOf('@'));
        StringBuilder sb = new StringBuilder();
        for (String part : local.split("[._\\-+]+")) {
            if (part.isEmpty()) {
                continue;
            }
            if (!sb.isEmpty()) {
                sb.append(' ');
            }
            sb.append(Character.toUpperCase(part.charAt(0))).append(part.substring(1));
        }
        return sb.isEmpty() ? email : sb.toString();
    }

    private static String randomToken() {
        byte[] b = new byte[32];
        RANDOM.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    private static String nn(String s) {
        return s == null ? "" : s.trim();
    }

    private static ApiException invalidCode() {
        return ApiException.badRequest("INVALID_CODE", "The code is wrong or has expired — request a new one");
    }

    private static ApiException invalidLink() {
        return ApiException.badRequest("INVALID_LINK", "The link is invalid or has expired — request a new one");
    }

    private static ApiException methodOff(String message) {
        return ApiException.conflict("METHOD_DISABLED", message);
    }
}
