package az.bugtrack.auth;

import java.util.ArrayList;
import java.util.Hashtable;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import javax.naming.AuthenticationException;
import javax.naming.Context;
import javax.naming.NamingEnumeration;
import javax.naming.NamingException;
import javax.naming.directory.Attribute;
import javax.naming.directory.Attributes;
import javax.naming.directory.DirContext;
import javax.naming.directory.InitialDirContext;
import javax.naming.directory.SearchControls;
import javax.naming.directory.SearchResult;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import az.bugtrack.config.AppProperties;

/**
 * Active Directory / LDAP sign-in with the JDK's own LDAP client (no extra libraries):
 *   1. bind with the service account and find the user by what they typed (login, UPN or e-mail);
 *   2. bind again as that user with their password — success means the password is right;
 *   3. read e-mail, display name, login and groups (memberOf) to create / update the local account.
 * The password is never stored or logged.
 */
@Component
public class LdapAuthenticator {

    private static final Logger log = LoggerFactory.getLogger(LdapAuthenticator.class);

    /** What the directory says about a user. */
    public record LdapUser(String dn, String username, String email, String fullName, List<String> groups) {
    }

    /** Result of the admin panel's "Test connection". */
    public record TestResult(boolean ok, String message, LdapUser user) {
    }

    private final LdapConfigService configs;

    public LdapAuthenticator(LdapConfigService configs) {
        this.configs = configs;
    }

    /** A directory is configured (admin panel or .env). Whether the method is switched on is decided by AuthMethods. */
    public boolean enabled() {
        return configs.configured();
    }

    /**
     * @return the user when the login and password are valid; empty when the user is not found
     *         or the password is wrong
     * @throws NamingException when the directory is unreachable or misconfigured
     */
    public Optional<LdapUser> authenticate(String login, String password) throws NamingException {
        AppProperties.Ldap cfg = configs.current();
        if (cfg == null || !cfg.enabled() || login == null || login.isBlank() || password == null || password.isEmpty()) {
            return Optional.empty();   // an empty password would be an anonymous bind — never accept it
        }
        Optional<LdapUser> found = find(cfg, login.trim());
        if (found.isEmpty()) {
            return Optional.empty();
        }
        DirContext userCtx = null;
        try {
            userCtx = new InitialDirContext(env(cfg, found.get().dn(), password));
            return found;
        } catch (AuthenticationException e) {
            return Optional.empty();
        } finally {
            close(userCtx);
        }
    }

    /** Admin check of the saved configuration. */
    public TestResult test(String login) {
        return test(configs.current(), login);
    }

    /** Admin check: can the service account connect, and (optionally) is this login found. */
    public TestResult test(AppProperties.Ldap cfg, String login) {
        if (cfg == null || !cfg.enabled()) {
            return new TestResult(false, "LDAP is not configured", null);
        }
        try {
            if (login == null || login.isBlank()) {
                close(new InitialDirContext(env(cfg, cfg.bindDn(), cfg.bindPassword())));
                return new TestResult(true, "Connected to the directory", null);
            }
            Optional<LdapUser> user = find(cfg, login.trim());
            return user.map(u -> new TestResult(true, "User found", u))
                    .orElseGet(() -> new TestResult(false, "Connected, but the user was not found", null));
        } catch (NamingException e) {
            return new TestResult(false, describe(e), null);
        }
    }

    /** Role from group membership, or null when no configured group matches. */
    public String roleFromGroups(List<String> groups) {
        AppProperties.Ldap cfg = configs.current();
        if (cfg == null) {
            return null;
        }
        Map<String, String> map = cfg.groupRoleMap();
        if (map.isEmpty() || groups == null) {
            return null;
        }
        List<String> lower = groups.stream().map(g -> g.toLowerCase(Locale.ROOT)).toList();
        for (Map.Entry<String, String> e : map.entrySet()) {
            if (lower.contains(e.getKey())) {
                return e.getValue();
            }
        }
        return null;
    }

    public boolean rolesFromGroups() {
        AppProperties.Ldap cfg = configs.current();
        return cfg != null && cfg.enabled() && !cfg.groupRoleMap().isEmpty();
    }

    public String defaultRole() {
        AppProperties.Ldap cfg = configs.current();
        return cfg == null ? "DEVELOPER" : cfg.roleByDefault();
    }

    // ------------------------------------------------------------------

    private Optional<LdapUser> find(AppProperties.Ldap cfg, String login) throws NamingException {
        DirContext ctx = new InitialDirContext(env(cfg, cfg.bindDn(), cfg.bindPassword()));
        try {
            SearchControls sc = new SearchControls();
            sc.setSearchScope(SearchControls.SUBTREE_SCOPE);
            sc.setCountLimit(2);
            sc.setTimeLimit((int) timeoutMs(cfg));
            sc.setReturningAttributes(new String[] {
                    cfg.emailAttr(), cfg.nameAttr(), cfg.usernameAttr(), "cn", "memberOf", "userPrincipalName" });
            String filter = cfg.filter().replace("{0}", escape(login));
            NamingEnumeration<SearchResult> results = ctx.search(cfg.baseDn(), filter, sc);
            List<SearchResult> list = new ArrayList<>();
            try {
                while (results.hasMore() && list.size() < 2) {
                    list.add(results.next());
                }
            } catch (javax.naming.SizeLimitExceededException e) {
                // more than one match: treated as "not found" below
            } catch (javax.naming.PartialResultException e) {
                // AD referrals outside the base DN: ignore
            }
            if (list.size() != 1) {
                if (list.size() > 1) {
                    log.warn("LDAP filter matched several entries for login '{}' — refine LDAP_USER_FILTER", login);
                }
                return Optional.empty();
            }
            SearchResult r = list.get(0);
            Attributes a = r.getAttributes();
            String email = first(a, cfg.emailAttr());
            if (email == null) {
                email = first(a, "userPrincipalName");
            }
            if (email == null) {
                log.warn("LDAP user {} has no e-mail ({} / userPrincipalName) — cannot sign in", r.getNameInNamespace(),
                        cfg.emailAttr());
                return Optional.empty();
            }
            String name = first(a, cfg.nameAttr());
            if (name == null) {
                name = first(a, "cn");
            }
            String username = first(a, cfg.usernameAttr());
            return Optional.of(new LdapUser(r.getNameInNamespace(), username, email,
                    name == null ? email : name, all(a, "memberOf")));
        } finally {
            close(ctx);
        }
    }

    private static Hashtable<String, String> env(AppProperties.Ldap cfg, String principal, String password) {
        Hashtable<String, String> env = new Hashtable<>();
        env.put(Context.INITIAL_CONTEXT_FACTORY, "com.sun.jndi.ldap.LdapCtxFactory");
        env.put(Context.PROVIDER_URL, cfg.url().trim());
        env.put(Context.SECURITY_AUTHENTICATION, "simple");
        if (principal != null && !principal.isBlank()) {
            env.put(Context.SECURITY_PRINCIPAL, principal);
            env.put(Context.SECURITY_CREDENTIALS, password == null ? "" : password);
        }
        env.put(Context.REFERRAL, "ignore");
        env.put("com.sun.jndi.ldap.connect.timeout", String.valueOf(timeoutMs(cfg)));
        env.put("com.sun.jndi.ldap.read.timeout", String.valueOf(timeoutMs(cfg)));
        return env;
    }

    private static long timeoutMs(AppProperties.Ldap cfg) {
        return cfg.timeout() == null ? 5000 : cfg.timeout().toMillis();
    }

    /** RFC 4515 escaping, so what the user typed cannot change the search filter. */
    static String escape(String value) {
        StringBuilder sb = new StringBuilder(value.length());
        for (char c : value.toCharArray()) {
            switch (c) {
                case '\\' -> sb.append("\\5c");
                case '*' -> sb.append("\\2a");
                case '(' -> sb.append("\\28");
                case ')' -> sb.append("\\29");
                case '\0' -> sb.append("\\00");
                default -> sb.append(c);
            }
        }
        return sb.toString();
    }

    private static String first(Attributes attrs, String name) throws NamingException {
        Attribute a = attrs.get(name);
        if (a == null || a.size() == 0) {
            return null;
        }
        Object v = a.get(0);
        return v == null ? null : v.toString();
    }

    private static List<String> all(Attributes attrs, String name) throws NamingException {
        List<String> out = new ArrayList<>();
        Attribute a = attrs.get(name);
        if (a != null) {
            for (int i = 0; i < a.size(); i++) {
                out.add(String.valueOf(a.get(i)));
            }
        }
        return out;
    }

    private static void close(DirContext ctx) {
        if (ctx != null) {
            try {
                ctx.close();
            } catch (NamingException ignored) {
                // nothing to do
            }
        }
    }

    static String describe(NamingException e) {
        String msg = e.getExplanation() != null ? e.getExplanation() : e.getClass().getSimpleName();
        if (e.getRootCause() != null) {
            msg += " (" + e.getRootCause().getMessage() + ")";
        }
        return msg;
    }
}
