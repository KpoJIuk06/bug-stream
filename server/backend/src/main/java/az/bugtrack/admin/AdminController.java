package az.bugtrack.admin;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.annotation.JsonRawValue;

import az.bugtrack.auth.LdapConfigService;
import az.bugtrack.common.ApiException;
import az.bugtrack.common.PageDto;
import az.bugtrack.config.AppProperties;
import az.bugtrack.mail.MailService;
import az.bugtrack.security.AuthUser;
import az.bugtrack.settings.SettingsService;

/** Admin panel: overview, global settings, audit log. */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    public record Overview(long users, long activeUsers, long ldapUsers, long projects, long reports,
                           long reportsLast7Days, long storageBytes, boolean ldapEnabled, boolean mailEnabled,
                           String publicUrl) {
    }

    public record AuditEntry(UUID id, String tableName, UUID rowId, UUID projectId, String action,
                             @JsonRawValue String oldData, @JsonRawValue String newData,
                             UUID changedBy, String changedByName, OffsetDateTime changedAt) {
    }

    private final JdbcClient jdbc;
    private final SettingsService settings;
    private final LdapConfigService ldap;
    private final MailService mail;
    private final AppProperties props;

    public AdminController(JdbcClient jdbc, SettingsService settings, LdapConfigService ldap, MailService mail,
                           AppProperties props) {
        this.jdbc = jdbc;
        this.settings = settings;
        this.ldap = ldap;
        this.mail = mail;
        this.props = props;
    }

    @GetMapping("/overview")
    @Transactional(readOnly = true)
    public Overview overview() {
        return jdbc.sql("""
                SELECT (SELECT count(*) FROM app_user WHERE email <> 'widget@adtask.local') AS users,
                       (SELECT count(*) FROM app_user WHERE is_active AND email <> 'widget@adtask.local') AS active_users,
                       (SELECT count(*) FROM app_user WHERE auth_source = 'LDAP') AS ldap_users,
                       (SELECT count(*) FROM project WHERE archived_at IS NULL) AS projects,
                       (SELECT count(*) FROM v_report_card) AS reports,
                       (SELECT count(*) FROM v_report_card WHERE created_at > now() - interval '7 days') AS reports_week,
                       (SELECT coalesce(sum(size_bytes), 0) FROM stored_file) AS storage_bytes
                """)
                .query((rs, i) -> new Overview(rs.getLong("users"), rs.getLong("active_users"), rs.getLong("ldap_users"),
                        rs.getLong("projects"), rs.getLong("reports"), rs.getLong("reports_week"),
                        rs.getLong("storage_bytes"), ldap.configured(), mail.isConfigured(),
                        props.publicUrl()))
                .single();
    }

    /** General settings. Sign-in settings (auth.*) live in /api/admin/auth with their own checks. */
    @GetMapping("/settings")
    public Map<String, Object> settings() {
        return withoutAuth(settings.all());
    }

    @PutMapping("/settings")
    @PreAuthorize("hasAuthority('settings.manage')")
    public Map<String, Object> updateSettings(@AuthenticationPrincipal AuthUser me,
                                              @RequestBody Map<String, Object> changes) {
        if (changes.keySet().stream().anyMatch(k -> k.startsWith("auth."))) {
            throw ApiException.badRequest("UNKNOWN_SETTING", "Sign-in settings are changed in Administration → Sign-in methods");
        }
        return withoutAuth(settings.update(changes, me.id()));
    }

    private static Map<String, Object> withoutAuth(Map<String, Object> all) {
        Map<String, Object> out = new java.util.LinkedHashMap<>(all);
        out.keySet().removeIf(k -> k.startsWith("auth."));
        return out;
    }

    @GetMapping("/audit")
    @PreAuthorize("hasAuthority('audit.view')")
    @Transactional(readOnly = true)
    public PageDto<AuditEntry> audit(@RequestParam(required = false) String table,
                                     @RequestParam(required = false) UUID userId,
                                     @RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "50") int size) {
        int p = Math.max(page, 0);
        int s = Math.clamp(size, 1, 200);
        String where = """
                 WHERE (CAST(:table AS text) IS NULL OR a.table_name = :table)
                   AND (CAST(:userId AS uuid) IS NULL OR a.changed_by = :userId)
                """;
        List<AuditEntry> items = jdbc.sql("""
                SELECT a.id, a.table_name, a.row_id, a.project_id, a.action, a.old_data::text AS old_data,
                       a.new_data::text AS new_data, a.changed_by, u.full_name AS changed_by_name, a.changed_at
                  FROM audit_log a
                  LEFT JOIN app_user u ON u.id = a.changed_by
                """ + where + " ORDER BY a.id DESC LIMIT :limit OFFSET :offset")
                .param("table", blankToNull(table))
                .param("userId", userId)
                .param("limit", s)
                .param("offset", p * s)
                .query((rs, i) -> new AuditEntry(
                        rs.getObject("id", UUID.class), rs.getString("table_name"), rs.getObject("row_id", UUID.class),
                        rs.getObject("project_id", UUID.class), rs.getString("action"), rs.getString("old_data"),
                        rs.getString("new_data"), rs.getObject("changed_by", UUID.class),
                        rs.getString("changed_by_name"), rs.getObject("changed_at", OffsetDateTime.class)))
                .list();
        long total = jdbc.sql("SELECT count(*) FROM audit_log a" + where)
                .param("table", blankToNull(table))
                .param("userId", userId)
                .query(Long.class)
                .single();
        return new PageDto<>(items, p, s, total);
    }

    @GetMapping("/audit/tables")
    @PreAuthorize("hasAuthority('audit.view')")
    public List<String> auditTables() {
        return jdbc.sql("SELECT DISTINCT table_name FROM audit_log ORDER BY 1").query(String.class).list();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
