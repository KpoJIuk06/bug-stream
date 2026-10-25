package az.bugtrack.config;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app")
public record AppProperties(Jwt jwt, BootstrapAdmin bootstrapAdmin, Cors cors, Storage storage,
                            String publicUrl, Mail mail, String integrationSecret, Ldap ldap) {

    /** SMTP for notifications. Empty host: e-mail is off (notifications only on the site). */
    public record Mail(String host, Integer port, String username, String password, String from, Boolean starttls,
                       Boolean ssl) {

        public boolean enabled() {
            return host != null && !host.isBlank();
        }
    }

    public record Jwt(String secret, Duration accessTtl, Duration refreshTtlWeb, Duration refreshTtlExtension) {
    }

    public record BootstrapAdmin(String email, String password, String fullName) {
    }

    public record Cors(List<String> allowedOriginPatterns) {
    }

    public record Storage(String root) {
    }

    /**
     * Sign-in with Active Directory / LDAP. Empty url: LDAP is off, only local accounts work.
     *
     * @param url          ldaps://dc1.corp.local:636 (several URLs separated by spaces = failover)
     * @param baseDn       where users are searched: DC=corp,DC=local
     * @param bindDn       service account that searches users (read-only)
     * @param userFilter   {0} = what the user typed; default matches sAMAccountName, userPrincipalName or mail
     * @param groupRoles   "CN=BugStream-Admins,OU=Groups,DC=corp,DC=local=ADMIN;CN=QA,...=TESTER" —
     *                     group membership decides the role on every sign-in; empty = roles are managed in the admin panel
     * @param defaultRole  role of a user created on the first LDAP sign-in when no group matches
     */
    public record Ldap(String url, String baseDn, String bindDn, String bindPassword, String userFilter,
                       String emailAttribute, String nameAttribute, String usernameAttribute,
                       String groupRoles, String defaultRole, Duration timeout) {

        public boolean enabled() {
            return url != null && !url.isBlank();
        }

        public String filter() {
            return userFilter == null || userFilter.isBlank()
                    ? "(&(objectClass=user)(|(sAMAccountName={0})(userPrincipalName={0})(mail={0})))"
                    : userFilter;
        }

        public String emailAttr() {
            return blank(emailAttribute) ? "mail" : emailAttribute;
        }

        public String nameAttr() {
            return blank(nameAttribute) ? "displayName" : nameAttribute;
        }

        public String usernameAttr() {
            return blank(usernameAttribute) ? "sAMAccountName" : usernameAttribute;
        }

        public String roleByDefault() {
            return blank(defaultRole) ? "DEVELOPER" : defaultRole;
        }

        /** Group DN (lower case) → role code, in the order they are written: the first match wins. */
        public Map<String, String> groupRoleMap() {
            Map<String, String> map = new LinkedHashMap<>();
            if (blank(groupRoles)) {
                return map;
            }
            for (String part : groupRoles.split(";")) {
                int eq = part.lastIndexOf('=');
                if (eq > 0) {
                    map.put(part.substring(0, eq).trim().toLowerCase(java.util.Locale.ROOT), part.substring(eq + 1).trim());
                }
            }
            return map;
        }

        private static boolean blank(String s) {
            return s == null || s.isBlank();
        }
    }
}
