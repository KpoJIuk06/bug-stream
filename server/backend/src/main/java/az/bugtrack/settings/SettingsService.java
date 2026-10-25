package az.bugtrack.settings;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import az.bugtrack.common.ApiException;
import tools.jackson.databind.ObjectMapper;

/**
 * Global settings edited in the admin panel (table app_setting). Only known keys are accepted;
 * a key that was never saved returns its default.
 */
@Service
public class SettingsService {

    public static final String SHARING_ENABLED = "sharing.enabled";
    public static final String SHARING_DEFAULT_DAYS = "sharing.defaultDays";
    public static final String SHARING_MAX_DAYS = "sharing.maxDays";
    public static final String SHARING_NETWORK_BODIES = "sharing.networkBodies";

    // sign-in methods (Administration → Sign-in)
    public static final String AUTH_PASSWORD = "auth.password.enabled";
    public static final String AUTH_PASSWORD_RESET = "auth.password.reset";
    public static final String AUTH_LDAP = "auth.ldap.enabled";
    public static final String AUTH_EMAIL_CODE = "auth.emailCode.enabled";
    public static final String AUTH_EMAIL_DOMAINS = "auth.emailCode.domains";
    public static final String AUTH_EMAIL_AUTO_CREATE = "auth.emailCode.autoCreate";
    public static final String AUTH_EMAIL_ROLE = "auth.emailCode.defaultRole";

    /** Key → default value. The type of the default is the type the key accepts. */
    private static final Map<String, Object> DEFAULTS = new LinkedHashMap<>();

    static {
        DEFAULTS.put(SHARING_ENABLED, true);          // "Open by link" is allowed at all
        DEFAULTS.put(SHARING_DEFAULT_DAYS, 30);       // a new link expires after N days
        DEFAULTS.put(SHARING_MAX_DAYS, 90);           // longest allowed expiry
        DEFAULTS.put(SHARING_NETWORK_BODIES, true);   // public page shows request/response bodies
        DEFAULTS.put(AUTH_PASSWORD, true);            // local accounts sign in with a password
        DEFAULTS.put(AUTH_PASSWORD_RESET, true);      // "Forgot password?" by e-mail (needs SMTP)
        DEFAULTS.put(AUTH_LDAP, true);                // AD / LDAP (needs a configured directory)
        DEFAULTS.put(AUTH_EMAIL_CODE, false);         // one-time code by e-mail (needs SMTP)
        DEFAULTS.put(AUTH_EMAIL_DOMAINS, List.of());  // allowed e-mail domains for codes; empty = any
        DEFAULTS.put(AUTH_EMAIL_AUTO_CREATE, false);  // unknown address from an allowed domain → new user
        DEFAULTS.put(AUTH_EMAIL_ROLE, "VIEWER");      // role of such a new user
    }

    private static final Map<String, int[]> INT_RANGES = Map.of(
            SHARING_DEFAULT_DAYS, new int[] {1, 365},
            SHARING_MAX_DAYS, new int[] {1, 3650});

    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public SettingsService(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> all() {
        Map<String, Object> result = new LinkedHashMap<>(DEFAULTS);
        jdbc.sql("SELECT key, value::text AS value FROM app_setting")
                .query((rs, i) -> Map.entry(rs.getString("key"), rs.getString("value")))
                .list()
                .forEach(e -> {
                    if (DEFAULTS.containsKey(e.getKey())) {
                        result.put(e.getKey(), json.readValue(e.getValue(), Object.class));
                    }
                });
        return result;
    }

    public boolean bool(String key) {
        return Boolean.TRUE.equals(all().get(key));
    }

    public String string(String key) {
        Object v = all().get(key);
        return v instanceof String str ? str : (String) DEFAULTS.get(key);
    }

    @SuppressWarnings("unchecked")
    public List<String> strings(String key) {
        Object v = all().get(key);
        return v instanceof List<?> l ? l.stream().map(String::valueOf).toList() : (List<String>) DEFAULTS.get(key);
    }

    public int integer(String key) {
        Object v = all().get(key);
        return v instanceof Number n ? n.intValue() : ((Number) DEFAULTS.get(key)).intValue();
    }

    @Transactional
    public Map<String, Object> update(Map<String, Object> changes, UUID by) {
        for (Map.Entry<String, Object> e : changes.entrySet()) {
            Object def = DEFAULTS.get(e.getKey());
            if (def == null) {
                throw ApiException.badRequest("UNKNOWN_SETTING", "Unknown setting: " + e.getKey());
            }
            Object v = e.getValue();
            boolean ok = (def instanceof Boolean && v instanceof Boolean)
                    || (def instanceof Integer && v instanceof Number n && n.doubleValue() == Math.rint(n.doubleValue()))
                    || (def instanceof String && v instanceof String)
                    || (def instanceof List && v instanceof List);
            if (!ok) {
                throw ApiException.badRequest("INVALID_SETTING", "Wrong type for " + e.getKey());
            }
            if (def instanceof Integer) {
                int[] range = INT_RANGES.get(e.getKey());
                int iv = ((Number) v).intValue();
                if (range != null && (iv < range[0] || iv > range[1])) {
                    throw ApiException.badRequest("INVALID_SETTING",
                            e.getKey() + " must be between " + range[0] + " and " + range[1]);
                }
                v = iv;
            }
            jdbc.sql("""
                    INSERT INTO app_setting (key, value, updated_by) VALUES (:key, CAST(:value AS jsonb), :by)
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by,
                                                    updated_at = now()
                    """)
                    .param("key", e.getKey())
                    .param("value", json.writeValueAsString(v))
                    .param("by", by)
                    .update();
        }
        Map<String, Object> result = all();
        if (((Number) result.get(SHARING_DEFAULT_DAYS)).intValue() > ((Number) result.get(SHARING_MAX_DAYS)).intValue()) {
            throw ApiException.badRequest("INVALID_SETTING", "Default link expiry cannot exceed the maximum");
        }
        return result;
    }
}
