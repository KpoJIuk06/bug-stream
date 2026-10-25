package az.bugtrack.auth;

import static az.bugtrack.settings.SettingsService.AUTH_EMAIL_AUTO_CREATE;
import static az.bugtrack.settings.SettingsService.AUTH_EMAIL_CODE;
import static az.bugtrack.settings.SettingsService.AUTH_EMAIL_DOMAINS;
import static az.bugtrack.settings.SettingsService.AUTH_EMAIL_ROLE;
import static az.bugtrack.settings.SettingsService.AUTH_LDAP;
import static az.bugtrack.settings.SettingsService.AUTH_PASSWORD;
import static az.bugtrack.settings.SettingsService.AUTH_PASSWORD_RESET;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import az.bugtrack.access.Permissions;
import az.bugtrack.access.PermissionService;
import az.bugtrack.access.RoleRepository;
import az.bugtrack.common.ApiException;
import az.bugtrack.mail.MailService;
import az.bugtrack.settings.SettingsService;
import az.bugtrack.user.UserRecord;

/**
 * Which sign-in methods are on. A method is available only when it is switched on in
 * Administration → Sign-in AND what it needs is configured:
 * <ul>
 *   <li>PASSWORD — local accounts; nothing extra. Even when switched off, users with the admin.access
 *       permission can still sign in with their local password (so the instance can never be locked out);</li>
 *   <li>PASSWORD_RESET — "Forgot password?" link by e-mail; needs PASSWORD and SMTP;</li>
 *   <li>LDAP — Active Directory / LDAP; needs a directory (Administration → Sign-in or LDAP_* in .env);</li>
 *   <li>EMAIL_CODE — one-time 6-digit code by e-mail; needs SMTP.</li>
 * </ul>
 * New methods (e.g. OIDC single sign-on) plug in the same way: a setting + what they need.
 */
@Service
public class AuthMethods {

    /** What the sign-in page and the extension show. */
    public record Effective(boolean password, boolean passwordReset, boolean ldap, boolean emailCode) {
    }

    /** Administration → Sign-in. */
    public record AdminView(Map<String, Object> settings, Effective effective, boolean mailConfigured,
                            String mailSource, boolean ldapConfigured, String ldapSource) {
    }

    private final SettingsService settings;
    private final MailService mail;
    private final LdapConfigService ldap;
    private final PermissionService permissions;
    private final RoleRepository roles;

    public AuthMethods(SettingsService settings, MailService mail, LdapConfigService ldap,
                       PermissionService permissions, RoleRepository roles) {
        this.settings = settings;
        this.mail = mail;
        this.ldap = ldap;
        this.permissions = permissions;
        this.roles = roles;
    }

    public Effective effective() {
        Map<String, Object> s = settings.all();
        return effective(s, mail.isConfigured(), ldap.configured());
    }

    private static Effective effective(Map<String, Object> s, boolean mailOn, boolean ldapOn) {
        boolean password = on(s, AUTH_PASSWORD);
        return new Effective(password, password && on(s, AUTH_PASSWORD_RESET) && mailOn,
                on(s, AUTH_LDAP) && ldapOn, on(s, AUTH_EMAIL_CODE) && mailOn);
    }

    /** The break-glass rule: administrators keep their local password even when PASSWORD is off. */
    public boolean passwordAllowedFor(UserRecord user) {
        return effective().password() || permissions.forRole(user.role()).contains(Permissions.ADMIN_ACCESS);
    }

    /** E-mail code: is this address allowed by the domain list. */
    public boolean domainAllowed(String email) {
        List<String> domains = settings.strings(AUTH_EMAIL_DOMAINS);
        if (domains.isEmpty()) {
            return true;
        }
        String domain = email.substring(email.lastIndexOf('@') + 1).toLowerCase(Locale.ROOT);
        return domains.stream().anyMatch(d -> domain.equals(d) || domain.endsWith("." + d));
    }

    public boolean autoCreate() {
        return settings.bool(AUTH_EMAIL_AUTO_CREATE);
    }

    public String autoCreateRole() {
        String role = settings.string(AUTH_EMAIL_ROLE);
        return roles.findByCode(role).isPresent() ? role : "VIEWER";
    }

    // ----------------------------- admin -----------------------------

    public AdminView adminView() {
        Map<String, Object> s = authOnly(settings.all());
        var ms = mail.status();
        var ls = ldap.status();
        return new AdminView(s, effective(s, ms.configured(), ls.configured()), ms.configured(), ms.source(),
                ls.configured(), ls.source());
    }

    @Transactional
    public AdminView update(Map<String, Object> changes, UUID by) {
        Map<String, Object> clean = new LinkedHashMap<>();
        for (Map.Entry<String, Object> e : changes.entrySet()) {
            if (!e.getKey().startsWith("auth.")) {
                throw ApiException.badRequest("UNKNOWN_SETTING", "Unknown sign-in setting: " + e.getKey());
            }
            Object v = e.getValue();
            if (AUTH_EMAIL_DOMAINS.equals(e.getKey())) {
                v = domains(v);
            }
            if (AUTH_EMAIL_ROLE.equals(e.getKey()) && (!(v instanceof String r) || roles.findByCode(r).isEmpty())) {
                throw ApiException.badRequest("INVALID_ROLE", "Unknown role: " + v);
            }
            clean.put(e.getKey(), v);
        }
        Map<String, Object> next = new LinkedHashMap<>(settings.all());
        next.putAll(clean);
        Effective eff = effective(next, mail.isConfigured(), ldap.configured());
        if (!eff.password() && !eff.ldap() && !eff.emailCode()) {
            throw ApiException.badRequest("NO_SIGN_IN_METHOD",
                    "At least one sign-in method must stay available (an e-mail code needs SMTP, AD / LDAP needs a directory)");
        }
        settings.update(clean, by);
        return adminView();
    }

    private static List<String> domains(Object v) {
        if (!(v instanceof List<?> list)) {
            throw ApiException.badRequest("INVALID_SETTING", "Domains must be a list");
        }
        List<String> out = new ArrayList<>();
        for (Object o : list) {
            String d = String.valueOf(o).trim().toLowerCase(Locale.ROOT);
            if (d.startsWith("@")) {
                d = d.substring(1);
            }
            if (d.isEmpty()) {
                continue;
            }
            if (!d.matches("[a-z0-9-]+(\\.[a-z0-9-]+)+")) {
                throw ApiException.badRequest("INVALID_DOMAIN", "Not a domain: " + o);
            }
            if (!out.contains(d)) {
                out.add(d);
            }
        }
        return out;
    }

    private static Map<String, Object> authOnly(Map<String, Object> all) {
        Map<String, Object> out = new LinkedHashMap<>();
        all.forEach((k, v) -> {
            if (k.startsWith("auth.")) {
                out.put(k, v);
            }
        });
        return out;
    }

    private static boolean on(Map<String, Object> s, String key) {
        return Boolean.TRUE.equals(s.get(key));
    }
}
