package az.bugtrack.auth;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import az.bugtrack.access.RoleRepository;
import az.bugtrack.common.ApiException;
import az.bugtrack.config.AppProperties;
import az.bugtrack.integration.SecretCipher;

/**
 * Active Directory / LDAP connection. Set in Administration → Sign-in → AD / LDAP; until then LDAP_* from .env.
 * The service account password is stored encrypted and never returned by the API.
 */
@Service
public class LdapConfigService {

    private static final Logger log = LoggerFactory.getLogger(LdapConfigService.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    /** source: DB — admin panel; ENV — .env; NONE — not configured. */
    public record LdapStatus(boolean configured, String source, String url, String baseDn, String bindDn,
                             boolean bindPasswordSet, String userFilter, String emailAttribute, String nameAttribute,
                             String usernameAttribute, String groupRoles, String defaultRole, OffsetDateTime updatedAt) {
    }

    /** bindPassword: empty = keep the saved one. */
    public record LdapRequest(String url, String baseDn, String bindDn, String bindPassword, String userFilter,
                              String emailAttribute, String nameAttribute, String usernameAttribute,
                              String groupRoles, String defaultRole) {
    }

    private record Loaded(String source, AppProperties.Ldap cfg, OffsetDateTime updatedAt) {
    }

    private final JdbcClient jdbc;
    private final SecretCipher cipher;
    private final AppProperties props;
    private final RoleRepository roles;
    private volatile Loaded cached;

    public LdapConfigService(JdbcClient jdbc, SecretCipher cipher, AppProperties props, RoleRepository roles) {
        this.jdbc = jdbc;
        this.cipher = cipher;
        this.props = props;
        this.roles = roles;
    }

    /** The active configuration; disabled (empty url) when LDAP is not set anywhere. */
    public AppProperties.Ldap current() {
        return loaded().cfg();
    }

    public boolean configured() {
        AppProperties.Ldap c = current();
        return c != null && c.enabled();
    }

    public LdapStatus status() {
        Loaded l = loaded();
        AppProperties.Ldap c = l.cfg();
        if (c == null || !c.enabled()) {
            return new LdapStatus(false, "NONE", null, null, null, false, null, null, null, null, null, null, null);
        }
        return new LdapStatus(true, l.source(), c.url(), c.baseDn(), c.bindDn(),
                c.bindPassword() != null && !c.bindPassword().isEmpty(), c.userFilter(), c.emailAttribute(),
                c.nameAttribute(), c.usernameAttribute(), c.groupRoles(), c.defaultRole(), l.updatedAt());
    }

    /** Builds a configuration from the form without saving it (for "Test connection"). */
    public AppProperties.Ldap candidate(LdapRequest req) {
        validate(req);
        String password = req.bindPassword() != null && !req.bindPassword().isEmpty()
                ? req.bindPassword()
                : current() != null ? current().bindPassword() : null;
        return toConfig(req, password);
    }

    @Transactional
    public LdapStatus save(LdapRequest req, UUID by) {
        validate(req);
        String enc;
        if (req.bindPassword() != null && !req.bindPassword().isEmpty()) {
            enc = cipher.encrypt(req.bindPassword());
        } else if (blank(req.bindDn())) {
            enc = null;
        } else {
            enc = jdbc.sql("SELECT bind_password_enc FROM ldap_connection WHERE id = 1").query(String.class).optional()
                    .orElseGet(() -> {
                        // first save after .env: keep the .env password
                        AppProperties.Ldap env = props.ldap();
                        return env != null && !blank(env.bindPassword()) ? cipher.encrypt(env.bindPassword()) : null;
                    });
        }
        jdbc.sql("""
                INSERT INTO ldap_connection (id, url, base_dn, bind_dn, bind_password_enc, user_filter, email_attribute,
                                             name_attribute, username_attribute, group_roles, default_role, updated_by)
                VALUES (1, :url, :baseDn, :bindDn, :pwd, :filter, :email, :name, :username, :groups, :role, :by)
                ON CONFLICT (id) DO UPDATE SET url = EXCLUDED.url, base_dn = EXCLUDED.base_dn, bind_dn = EXCLUDED.bind_dn,
                       bind_password_enc = EXCLUDED.bind_password_enc, user_filter = EXCLUDED.user_filter,
                       email_attribute = EXCLUDED.email_attribute, name_attribute = EXCLUDED.name_attribute,
                       username_attribute = EXCLUDED.username_attribute, group_roles = EXCLUDED.group_roles,
                       default_role = EXCLUDED.default_role, updated_by = EXCLUDED.updated_by
                """)
                .param("url", req.url().trim()).param("baseDn", req.baseDn().trim()).param("bindDn", trim(req.bindDn()))
                .param("pwd", enc).param("filter", trim(req.userFilter())).param("email", trim(req.emailAttribute()))
                .param("name", trim(req.nameAttribute())).param("username", trim(req.usernameAttribute()))
                .param("groups", trim(req.groupRoles())).param("role", trim(req.defaultRole())).param("by", by)
                .update();
        cached = null;
        return status();
    }

    /** Back to LDAP_* from .env (or off). */
    @Transactional
    public LdapStatus reset() {
        jdbc.sql("DELETE FROM ldap_connection").update();
        cached = null;
        return status();
    }

    // ------------------------------------------------------------------

    private Loaded loaded() {
        Loaded l = cached;
        if (l == null) {
            l = load();
            cached = l;
        }
        return l;
    }

    private Loaded load() {
        Optional<Loaded> db = jdbc.sql("""
                SELECT url, base_dn, bind_dn, bind_password_enc, user_filter, email_attribute, name_attribute,
                       username_attribute, group_roles, default_role, updated_at
                  FROM ldap_connection WHERE id = 1
                """)
                .query((rs, i) -> new Loaded("DB", new AppProperties.Ldap(rs.getString("url"), rs.getString("base_dn"),
                        rs.getString("bind_dn"), decrypt(rs.getString("bind_password_enc")), rs.getString("user_filter"),
                        rs.getString("email_attribute"), rs.getString("name_attribute"),
                        rs.getString("username_attribute"), rs.getString("group_roles"), rs.getString("default_role"),
                        TIMEOUT), rs.getObject("updated_at", OffsetDateTime.class)))
                .optional();
        if (db.isPresent()) {
            return db.get();
        }
        AppProperties.Ldap env = props.ldap();
        return new Loaded(env != null && env.enabled() ? "ENV" : "NONE", env, null);
    }

    private void validate(LdapRequest req) {
        if (blank(req.url()) || !req.url().trim().matches("(?i)ldaps?://\\S+(\\s+ldaps?://\\S+)*")) {
            throw ApiException.badRequest("INVALID_URL", "Server address like ldaps://dc1.example.com:636");
        }
        if (blank(req.baseDn())) {
            throw ApiException.badRequest("BASE_DN_REQUIRED", "Enter the base DN, e.g. DC=example,DC=com");
        }
        if (!blank(req.userFilter()) && !req.userFilter().contains("{0}")) {
            throw ApiException.badRequest("INVALID_FILTER", "The user filter must contain {0} — what the user typed");
        }
        if (!blank(req.defaultRole()) && roles.findByCode(req.defaultRole().trim()).isEmpty()) {
            throw ApiException.badRequest("INVALID_ROLE", "Unknown role: " + req.defaultRole());
        }
        AppProperties.Ldap probe = toConfig(req, null);
        for (String role : probe.groupRoleMap().values()) {
            if (roles.findByCode(role).isEmpty()) {
                throw ApiException.badRequest("INVALID_ROLE", "Unknown role in group mapping: " + role);
            }
        }
    }

    private static AppProperties.Ldap toConfig(LdapRequest req, String password) {
        return new AppProperties.Ldap(req.url().trim(), req.baseDn().trim(), trim(req.bindDn()), password,
                trim(req.userFilter()), trim(req.emailAttribute()), trim(req.nameAttribute()),
                trim(req.usernameAttribute()), trim(req.groupRoles()), trim(req.defaultRole()), TIMEOUT);
    }

    private String decrypt(String enc) {
        try {
            return cipher.decrypt(enc);
        } catch (IllegalStateException e) {
            log.error("Cannot decrypt the LDAP service account password — enter it again in Administration → Sign-in");
            return null;
        }
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static String trim(String s) {
        return blank(s) ? null : s.trim();
    }
}
