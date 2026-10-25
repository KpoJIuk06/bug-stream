package az.bugtrack.dashboard;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import az.bugtrack.access.Permissions;
import az.bugtrack.security.AuthUser;

/**
 * Numbers for the dashboard: counters, distributions, reports per day, the most frequent errors,
 * the user's queue and recent Jira issues. Only reports the user may see are counted.
 */
@RestController
public class DashboardController {

    public record Counters(long open, long createdInPeriod, long createdPrevPeriod, long resolvedInPeriod,
                           long unassignedOpen, long assignedToMeOpen, long criticalOpen) {
    }

    public record Bucket(String key, String label, long count) {
    }

    public record Day(LocalDate day, long created, long resolved) {
    }

    public record TopError(String kind, String summary, long reports, long events, OffsetDateTime lastSeen,
                           UUID sampleReportId) {
    }

    public record ReportRef(UUID id, String title, String status, String severity, String projectKey,
                            OffsetDateTime createdAt) {
    }

    public record JiraIssue(UUID reportId, String reportTitle, String key, String url, String createdBy,
                            OffsetDateTime createdAt) {
    }

    public record Dashboard(int days, Counters counters, List<Bucket> byStatus, List<Bucket> bySeverity,
                            List<Bucket> byEnvironment, List<Bucket> byProject, List<Bucket> topReporters,
                            List<Day> perDay, List<TopError> topErrors, List<ReportRef> myQueue,
                            List<JiraIssue> recentJira) {
    }

    /** Reports the viewer may see, optionally of one project. */
    private static final String SCOPE = """
            WITH r AS (
              SELECT c.* FROM v_report_card c
               WHERE (c.project_id IS NULL OR EXISTS (
                        SELECT 1 FROM project pp
                         WHERE pp.id = c.project_id
                           AND (pp.visibility = 'PUBLIC' OR :seesAll
                                OR EXISTS (SELECT 1 FROM project_member pm
                                            WHERE pm.project_id = pp.id AND pm.user_id = :me))))
                 AND (CAST(:projectId AS uuid) IS NULL OR c.project_id = :projectId)
            )
            """;

    private static final String OPEN = "r.status IN ('NEW', 'IN_PROGRESS')";

    private final JdbcClient jdbc;

    public DashboardController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/api/dashboard")
    @Transactional(readOnly = true)
    public Dashboard get(@AuthenticationPrincipal AuthUser me,
                         @RequestParam(required = false) UUID projectId,
                         @RequestParam(defaultValue = "30") int days) {
        int d = Math.clamp(days, 1, 365);
        Map<String, Object> p = new HashMap<>();
        p.put("me", me.id());
        p.put("seesAll", me.has(Permissions.PROJECT_VIEW_ALL));
        p.put("projectId", projectId);
        p.put("from", OffsetDateTime.now().minusDays(d));
        p.put("prevFrom", OffsetDateTime.now().minusDays(2L * d));
        p.put("days", d);

        String resolvedEvents = """
                , resolved AS (
                  SELECT DISTINCT ON (h.entity_id, h.changed_at::date) h.entity_id, h.changed_at
                    FROM entity_history h
                    JOIN attribute a ON a.id = h.attribute_id AND a.code = 'status' AND a.project_id IS NULL
                    JOIN r ON r.id = h.entity_id
                   WHERE h.changed_at >= :from AND h.new_value #>> '{}' IN ('RESOLVED', 'CLOSED')
                )
                """;

        Counters counters = jdbc.sql(SCOPE + resolvedEvents + """
                SELECT count(*) FILTER (WHERE %1$s) AS open,
                       count(*) FILTER (WHERE r.created_at >= :from) AS created,
                       count(*) FILTER (WHERE r.created_at >= :prevFrom AND r.created_at < :from) AS created_prev,
                       (SELECT count(DISTINCT entity_id) FROM resolved) AS resolved,
                       count(*) FILTER (WHERE %1$s AND r.assignee_id IS NULL) AS unassigned,
                       count(*) FILTER (WHERE %1$s AND r.assignee_id = :me) AS mine,
                       count(*) FILTER (WHERE %1$s AND r.severity = 'CRITICAL') AS critical
                  FROM r
                """.formatted(OPEN))
                .params(p)
                .query((rs, i) -> new Counters(rs.getLong("open"), rs.getLong("created"), rs.getLong("created_prev"),
                        rs.getLong("resolved"), rs.getLong("unassigned"), rs.getLong("mine"), rs.getLong("critical")))
                .single();

        List<Bucket> byStatus = buckets(SCOPE + """
                SELECT r.status AS key, r.status AS label, count(*) AS n FROM r GROUP BY r.status ORDER BY n DESC
                """, p);
        List<Bucket> bySeverity = buckets(SCOPE + """
                SELECT coalesce(r.severity, '') AS key, coalesce(r.severity, '') AS label, count(*) AS n
                  FROM r WHERE %s GROUP BY r.severity ORDER BY n DESC
                """.formatted(OPEN), p);
        List<Bucket> byEnvironment = buckets(SCOPE + """
                SELECT coalesce(r.environment, '') AS key, coalesce(e.name, r.environment, '') AS label, count(*) AS n
                  FROM r LEFT JOIN environment e ON e.code = r.environment
                 WHERE r.created_at >= :from
                 GROUP BY r.environment, e.name, e.sort_order ORDER BY e.sort_order NULLS LAST
                """, p);
        List<Bucket> byProject = buckets(SCOPE + """
                SELECT coalesce(r.project_id::text, '') AS key, coalesce(r.project_key, '') AS label, count(*) AS n
                  FROM r WHERE r.created_at >= :from
                 GROUP BY r.project_id, r.project_key ORDER BY n DESC LIMIT 8
                """, p);
        List<Bucket> topReporters = buckets(SCOPE + """
                SELECT r.created_by::text AS key, r.author_name AS label, count(*) AS n
                  FROM r WHERE r.created_at >= :from
                 GROUP BY r.created_by, r.author_name ORDER BY n DESC LIMIT 5
                """, p);

        List<Day> perDay = jdbc.sql(SCOPE + resolvedEvents + """
                SELECT g.day::date AS day,
                       (SELECT count(*) FROM r WHERE r.created_at::date = g.day::date) AS created,
                       (SELECT count(*) FROM resolved x WHERE x.changed_at::date = g.day::date) AS resolved
                  FROM generate_series((now() - make_interval(days => :days - 1))::date, now()::date, interval '1 day') AS g(day)
                 ORDER BY 1
                """)
                .params(p)
                .query((rs, i) -> new Day(rs.getObject("day", LocalDate.class), rs.getLong("created"), rs.getLong("resolved")))
                .list();

        List<TopError> topErrors = jdbc.sql(SCOPE + """
                SELECT e.kind, left(e.summary, 300) AS summary, count(DISTINCT e.report_id) AS reports, count(*) AS events,
                       max(r.created_at) AS last_seen, (array_agg(e.report_id ORDER BY r.created_at DESC))[1] AS sample
                  FROM report_event e JOIN r ON r.id = e.report_id
                 WHERE r.created_at >= :from
                   AND ((e.kind = 'CONSOLE' AND e.level = 'error')
                        OR (e.kind = 'NETWORK' AND (e.http_status >= 400 OR e.http_status = 0)))
                 GROUP BY e.kind, left(e.summary, 300)
                 ORDER BY reports DESC, events DESC
                 LIMIT 8
                """)
                .params(p)
                .query((rs, i) -> new TopError(rs.getString("kind"), rs.getString("summary"), rs.getLong("reports"),
                        rs.getLong("events"), rs.getObject("last_seen", OffsetDateTime.class),
                        rs.getObject("sample", UUID.class)))
                .list();

        List<ReportRef> myQueue = jdbc.sql(SCOPE + """
                SELECT r.id, r.title, r.status, r.severity, r.project_key, r.created_at
                  FROM r WHERE %s AND r.assignee_id = :me
                 ORDER BY CASE r.severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
                          r.created_at DESC
                 LIMIT 6
                """.formatted(OPEN))
                .params(p)
                .query((rs, i) -> new ReportRef(rs.getObject("id", UUID.class), rs.getString("title"), rs.getString("status"),
                        rs.getString("severity"), rs.getString("project_key"), rs.getObject("created_at", OffsetDateTime.class)))
                .list();

        List<JiraIssue> recentJira = jdbc.sql(SCOPE + """
                SELECT l.report_id, r.title, l.external_key, l.external_url, u.full_name, l.created_at
                  FROM report_external_link l
                  JOIN r ON r.id = l.report_id
                  LEFT JOIN app_user u ON u.id = l.created_by
                 ORDER BY l.created_at DESC
                 LIMIT 6
                """)
                .params(p)
                .query((rs, i) -> new JiraIssue(rs.getObject("report_id", UUID.class), rs.getString("title"),
                        rs.getString("external_key"), rs.getString("external_url"), rs.getString("full_name"),
                        rs.getObject("created_at", OffsetDateTime.class)))
                .list();

        return new Dashboard(d, counters, byStatus, bySeverity, byEnvironment, byProject, topReporters, perDay,
                topErrors, myQueue, recentJira);
    }

    private List<Bucket> buckets(String sql, Map<String, Object> p) {
        return jdbc.sql(sql)
                .params(p)
                .query((rs, i) -> new Bucket(rs.getString("key"), rs.getString("label"), rs.getLong("n")))
                .list();
    }
}
