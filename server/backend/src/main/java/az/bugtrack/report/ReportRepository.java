package az.bugtrack.report;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import az.bugtrack.report.ReportDtos.HistoryEntry;
import az.bugtrack.report.ReportDtos.ProjectRef;
import az.bugtrack.report.ReportDtos.Ref;
import az.bugtrack.report.ReportDtos.ReportFilter;
import az.bugtrack.report.ReportDtos.Summary;

/** Report-specific queries: list, events, counters, history. */
@Repository
public class ReportRepository {

    /** A list row as is from v_report_card (+ assignee name). */
    public record CardRow(UUID id, UUID projectId, String projectKey, String projectName, UUID serviceId,
                          String serviceName, UUID authorId, String authorName, UUID assigneeId, String assigneeName,
                          OffsetDateTime createdAt, OffsetDateTime updatedAt, String title, String status,
                          String severity, String environment, String pageUrl, String browser, String os, int durationMs,
                          int consoleErrors, int networkErrors, long commentsCount, UUID thumbnailFileId,
                          String jiraKey, String jiraUrl, String jiraStatus, String jiraCategory) {
    }

    /** One row of "grouped by project"; thumbnails are file ids of the latest previews. */
    public record GroupRow(UUID projectId, String projectKey, String projectName, String jiraProjectKey, long total,
                           long newCount, long inProgress, long done, long withErrors, long critical, long inJira,
                           long jiraDone, OffsetDateTime lastAt, List<UUID> thumbnails) {
    }

    /** The latest Jira link of a report (aliased j). */
    private static final String JIRA_JOIN = """
              LEFT JOIN LATERAL (
                    SELECT l.external_key, l.external_url, l.status_name, l.status_category
                      FROM report_external_link l
                     WHERE l.report_id = c.id AND l.type = 'JIRA' AND l.missing_at IS NULL
                     ORDER BY l.id DESC LIMIT 1) j ON true
            """;

    public record Header(UUID id, ProjectRef project, Ref service, Ref author, OffsetDateTime createdAt,
                         OffsetDateTime updatedAt, OffsetDateTime deletedAt) {
    }

    private final JdbcClient jdbc;

    public ReportRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ----------------------------- list -----------------------------

    public List<CardRow> list(ReportFilter f) {
        Map<String, Object> params = new HashMap<>();
        String where = where(f, params);
        String order = switch (f.sort() == null ? "newest" : f.sort()) {
            case "oldest" -> "c.id ASC";
            case "updated" -> "c.updated_at DESC, c.id DESC";
            default -> "c.id DESC";            // UUIDv7 grows with time = by creation date
        };
        params.put("limit", f.size());
        params.put("offset", f.page() * f.size());
        return jdbc.sql("""
                SELECT c.*, au.full_name AS assignee_name,
                       j.external_key AS jira_key, j.external_url AS jira_url, j.status_name AS jira_status,
                       j.status_category AS jira_category
                  FROM v_report_card_all c
                  LEFT JOIN app_user au ON au.id = c.assignee_id
                """ + JIRA_JOIN + where + " ORDER BY " + order + " LIMIT :limit OFFSET :offset")
                .params(params)
                .query((rs, n) -> new CardRow(
                        rs.getObject("id", UUID.class),
                        rs.getObject("project_id", UUID.class),
                        rs.getString("project_key"),
                        rs.getString("project_name"),
                        rs.getObject("service_id", UUID.class),
                        rs.getString("service_name"),
                        rs.getObject("created_by", UUID.class),
                        rs.getString("author_name"),
                        rs.getObject("assignee_id", UUID.class),
                        rs.getString("assignee_name"),
                        rs.getObject("created_at", OffsetDateTime.class),
                        rs.getObject("updated_at", OffsetDateTime.class),
                        rs.getString("title"),
                        rs.getString("status"),
                        rs.getString("severity"),
                        rs.getString("environment"),
                        rs.getString("page_url"),
                        rs.getString("browser"),
                        rs.getString("os"),
                        rs.getInt("duration_ms"),
                        rs.getInt("console_errors"),
                        rs.getInt("network_errors"),
                        rs.getLong("comments_count"),
                        rs.getObject("thumbnail_file_id", UUID.class),
                        rs.getString("jira_key"),
                        rs.getString("jira_url"),
                        rs.getString("jira_status"),
                        rs.getString("jira_category")))
                .list();
    }

    /** The filtered reports grouped by project, newest activity first. */
    public List<GroupRow> groups(ReportFilter f) {
        Map<String, Object> params = new HashMap<>();
        String where = where(f, params);
        List<GroupRow> rows = jdbc.sql("""
                SELECT c.project_id, max(c.project_key) AS project_key, max(c.project_name) AS project_name,
                       count(*) AS total,
                       count(*) FILTER (WHERE c.status = 'NEW') AS new_count,
                       count(*) FILTER (WHERE c.status = 'IN_PROGRESS') AS in_progress,
                       count(*) FILTER (WHERE c.status IN ('RESOLVED', 'CLOSED', 'REJECTED')) AS done,
                       count(*) FILTER (WHERE c.console_errors > 0 OR c.network_errors > 0) AS with_errors,
                       count(*) FILTER (WHERE c.severity IN ('HIGH', 'CRITICAL')
                                          AND coalesce(c.status, 'NEW') NOT IN ('RESOLVED', 'CLOSED', 'REJECTED')) AS critical,
                       count(j.external_key) AS in_jira,
                       count(*) FILTER (WHERE j.status_category = 'done') AS jira_done,
                       max(c.created_at) AS last_at
                  FROM v_report_card_all c
                """ + JIRA_JOIN + where + """
                 GROUP BY c.project_id
                 ORDER BY max(c.created_at) DESC
                 LIMIT 500
                """)
                .params(params)
                .query((rs, n) -> new GroupRow(rs.getObject("project_id", UUID.class), rs.getString("project_key"),
                        rs.getString("project_name"), null, rs.getLong("total"), rs.getLong("new_count"),
                        rs.getLong("in_progress"), rs.getLong("done"), rs.getLong("with_errors"), rs.getLong("critical"),
                        rs.getLong("in_jira"), rs.getLong("jira_done"), rs.getObject("last_at", OffsetDateTime.class),
                        List.of()))
                .list();
        if (rows.isEmpty()) {
            return rows;
        }
        // the latest 4 previews of each group (same filters)
        Map<UUID, List<UUID>> thumbs = new HashMap<>();
        UUID none = new UUID(0, 0);
        jdbc.sql("""
                SELECT project_id, thumbnail_file_id FROM (
                    SELECT c.project_id, c.thumbnail_file_id,
                           row_number() OVER (PARTITION BY c.project_id ORDER BY c.id DESC) AS rn
                      FROM v_report_card_all c
                """ + JIRA_JOIN + where + """
                       AND c.thumbnail_file_id IS NOT NULL) x
                 WHERE rn <= 4
                """)
                .params(params)
                .query((rs, n) -> {
                    UUID pid = rs.getObject("project_id", UUID.class);
                    thumbs.computeIfAbsent(pid == null ? none : pid, k -> new java.util.ArrayList<>())
                            .add(rs.getObject("thumbnail_file_id", UUID.class));
                    return null;
                })
                .list();
        Map<UUID, String> jiraKeys = new HashMap<>();
        jdbc.sql("SELECT p.id, j.key FROM project p JOIN jira_project j ON j.id = p.jira_project_id")
                .query((rs, n) -> jiraKeys.put(rs.getObject("id", UUID.class), rs.getString("key")))
                .list();
        return rows.stream().map(r -> new GroupRow(r.projectId(), r.projectKey(), r.projectName(),
                        r.projectId() == null ? null : jiraKeys.get(r.projectId()), r.total(), r.newCount(),
                        r.inProgress(), r.done(), r.withErrors(), r.critical(), r.inJira(), r.jiraDone(), r.lastAt(),
                        thumbs.getOrDefault(r.projectId() == null ? none : r.projectId(), List.of())))
                .toList();
    }

    public long count(ReportFilter f) {
        Map<String, Object> params = new HashMap<>();
        String where = where(f, params);
        return jdbc.sql("SELECT count(*) FROM v_report_card_all c " + JIRA_JOIN + where)
                .params(params)
                .query(Long.class)
                .single();
    }

    private static String where(ReportFilter f, Map<String, Object> p) {
        StringBuilder w = new StringBuilder(" WHERE 1 = 1");
        // PRIVATE projects are visible to members and project.view_all only
        w.append(" ").append("""
                 AND (c.project_id IS NULL OR EXISTS (
                        SELECT 1 FROM project pp
                         WHERE pp.id = c.project_id
                           AND (pp.visibility = 'PUBLIC' OR :viewerSeesAll
                                OR EXISTS (SELECT 1 FROM project_member pm
                                            WHERE pm.project_id = pp.id AND pm.user_id = :viewerId))))""");
        p.put("viewerSeesAll", f.viewerSeesAll());
        p.put("viewerId", f.viewerId());
        if (!f.includeDeleted()) {
            w.append(" AND c.deleted_at IS NULL");
        }
        if (f.projectId() != null) {
            w.append(" AND c.project_id = :projectId");
            p.put("projectId", f.projectId());
        } else if (f.noProject()) {
            w.append(" AND c.project_id IS NULL");
        }
        if (notEmpty(f.jira())) {
            List<String> parts = new java.util.ArrayList<>();
            for (String j : f.jira()) {
                switch (j) {
                    case "NONE" -> parts.add("j.external_key IS NULL");
                    case "ANY" -> parts.add("j.external_key IS NOT NULL");
                    case "TODO" -> parts.add("(j.external_key IS NOT NULL AND coalesce(j.status_category, 'new') = 'new')");
                    case "IN_PROGRESS" -> parts.add("j.status_category = 'indeterminate'");
                    case "DONE" -> parts.add("j.status_category = 'done'");
                    default -> { }
                }
            }
            if (!parts.isEmpty()) {
                w.append(" AND (").append(String.join(" OR ", parts)).append(")");
            }
        }
        if (f.serviceId() != null) {
            w.append(" AND c.service_id = :serviceId");
            p.put("serviceId", f.serviceId());
        }
        if (notEmpty(f.status())) {
            w.append(" AND c.status IN (:status)");
            p.put("status", f.status());
        }
        if (notEmpty(f.severity())) {
            w.append(" AND c.severity IN (:severity)");
            p.put("severity", f.severity());
        }
        if (notEmpty(f.environment())) {
            w.append(" AND c.environment IN (:environment)");
            p.put("environment", f.environment());
        }
        if (f.authorId() != null) {
            w.append(" AND c.created_by = :authorId");
            p.put("authorId", f.authorId());
        }
        if (f.assigneeId() != null) {
            w.append(" AND c.assignee_id = :assigneeId");
            p.put("assigneeId", f.assigneeId());
        }
        if (notEmpty(f.tag())) {
            w.append(" ").append("""
                     AND EXISTS (SELECT 1 FROM entity_value tv
                                   JOIN attribute ta ON ta.id = tv.attribute_id AND ta.code = 'tags' AND ta.project_id IS NULL
                                  WHERE tv.entity_id = c.id AND tv.v_string IN (:tags))""");
            p.put("tags", f.tag());
        }
        if (Boolean.TRUE.equals(f.hasErrors())) {
            w.append(" AND (c.console_errors > 0 OR c.network_errors > 0)");
        } else if (Boolean.FALSE.equals(f.hasErrors())) {
            w.append(" AND c.console_errors = 0 AND c.network_errors = 0");
        }
        if (f.from() != null) {
            w.append(" AND c.created_at >= :from");
            p.put("from", f.from());
        }
        if (f.to() != null) {
            w.append(" AND c.created_at < :to");
            p.put("to", f.to());
        }
        if (f.q() != null && !f.q().isBlank()) {
            w.append(" ").append("""
                     AND (c.title ILIKE :q OR c.page_url ILIKE :q
                          OR EXISTS (SELECT 1 FROM entity_value dv
                                       JOIN attribute da ON da.id = dv.attribute_id AND da.code = 'description'
                                      WHERE dv.entity_id = c.id AND dv.v_text ILIKE :q))""");
            p.put("q", "%" + f.q().trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%");
        }
        return w.toString();
    }

    private static boolean notEmpty(List<?> list) {
        return list != null && !list.isEmpty();
    }

    // ----------------------------- card -----------------------------

    public Optional<Header> header(UUID id) {
        return jdbc.sql("""
                SELECT e.id, e.created_at, e.updated_at, e.deleted_at,
                       p.id AS project_id, p.key AS project_key, p.name AS project_name,
                       s.id AS service_id, s.name AS service_name,
                       u.id AS author_id, u.full_name AS author_name
                  FROM entity e
                  JOIN entity_type t ON t.id = e.entity_type_id AND t.code = 'report'
                  JOIN app_user u ON u.id = e.created_by
                  LEFT JOIN project p ON p.id = e.project_id
                  LEFT JOIN project_service s ON s.id = e.service_id
                 WHERE e.id = :id
                """)
                .param("id", id)
                .query((rs, n) -> {
                    UUID projectId = rs.getObject("project_id", UUID.class);
                    UUID serviceId = rs.getObject("service_id", UUID.class);
                    return new Header(
                            rs.getObject("id", UUID.class),
                            projectId == null ? null
                                    : new ProjectRef(projectId, rs.getString("project_key"), rs.getString("project_name")),
                            serviceId == null ? null : new Ref(serviceId, rs.getString("service_name")),
                            new Ref(rs.getObject("author_id", UUID.class), rs.getString("author_name")),
                            rs.getObject("created_at", OffsetDateTime.class),
                            rs.getObject("updated_at", OffsetDateTime.class),
                            rs.getObject("deleted_at", OffsetDateTime.class));
                })
                .optional();
    }

    public Summary summary(UUID reportId) {
        return jdbc.sql("""
                SELECT duration_ms, events_total, console_errors, console_warnings,
                       network_total, network_errors, actions_total
                  FROM report_summary WHERE report_id = :id
                """)
                .param("id", reportId)
                .query((rs, n) -> new Summary(
                        rs.getInt("duration_ms"), rs.getInt("events_total"), rs.getInt("console_errors"),
                        rs.getInt("console_warnings"), rs.getInt("network_total"), rs.getInt("network_errors"),
                        rs.getInt("actions_total")))
                .optional()
                .orElse(new Summary(0, 0, 0, 0, 0, 0, 0));
    }

    // ----------------------------- events -----------------------------

    /**
     * Inserts events in one statement: PostgreSQL parses the JSON array itself.
     * Element format: {kind, t, ts, level, summary, method, status, duration, payload}
     *   kind  — console | network | action | navigation | custom
     *   t     — ms since the recording started; ts — unix time in ms
     * Invalid elements (unknown kind) are skipped.
     */
    public int insertEvents(UUID reportId, String eventsJson) {
        if (eventsJson == null || eventsJson.isBlank()) {
            return 0;
        }
        return jdbc.sql("""
                INSERT INTO report_event (report_id, kind, t_ms, occurred_at, level, summary,
                                          http_method, http_status, duration_ms, payload)
                SELECT CAST(:rid AS uuid),
                       upper(e ->> 'kind'),
                       CASE WHEN e ->> 't' ~ '^\\d{1,9}(\\.\\d+)?$' THEN round((e ->> 't')::numeric)::int ELSE 0 END,
                       CASE WHEN e ->> 'ts' ~ '^\\d{1,15}(\\.\\d+)?$'
                            THEN to_timestamp((e ->> 'ts')::numeric / 1000) ELSE now() END,
                       left(lower(e ->> 'level'), 20),
                       left(coalesce(e ->> 'summary', ''), 2000),
                       left(upper(e ->> 'method'), 10),
                       CASE WHEN e ->> 'status' ~ '^\\d{1,3}$' THEN (e ->> 'status')::smallint END,
                       CASE WHEN e ->> 'duration' ~ '^\\d{1,9}(\\.\\d+)?$'
                            THEN round((e ->> 'duration')::numeric)::int END,
                       CASE WHEN jsonb_typeof(e -> 'payload') = 'object' THEN e -> 'payload' ELSE '{}'::jsonb END
                  FROM jsonb_array_elements(CAST(:events AS jsonb)) AS e
                 WHERE jsonb_typeof(e) = 'object'
                   AND upper(e ->> 'kind') IN ('CONSOLE', 'NETWORK', 'ACTION', 'NAVIGATION', 'CUSTOM')
                """)
                .param("rid", reportId)
                .param("events", eventsJson)
                .update();
    }

    /** Recalculates the report counters from its events. */
    public void upsertSummary(UUID reportId, Integer durationMs, UUID videoFileId, UUID thumbnailFileId) {
        jdbc.sql("""
                INSERT INTO report_summary (report_id, duration_ms, events_total, console_errors, console_warnings,
                                            network_total, network_errors, actions_total, video_file_id, thumbnail_file_id)
                SELECT CAST(:rid AS uuid),
                       coalesce(CAST(:duration AS int), max(t_ms), 0),
                       count(*),
                       count(*) FILTER (WHERE kind = 'CONSOLE' AND level = 'error'),
                       count(*) FILTER (WHERE kind = 'CONSOLE' AND level IN ('warn', 'warning')),
                       count(*) FILTER (WHERE kind = 'NETWORK'),
                       count(*) FILTER (WHERE kind = 'NETWORK' AND (http_status >= 400 OR http_status = 0)),
                       count(*) FILTER (WHERE kind = 'ACTION'),
                       CAST(:video AS uuid), CAST(:thumb AS uuid)
                  FROM report_event WHERE report_id = CAST(:rid AS uuid)
                ON CONFLICT (report_id) DO UPDATE SET
                       duration_ms = EXCLUDED.duration_ms, events_total = EXCLUDED.events_total,
                       console_errors = EXCLUDED.console_errors, console_warnings = EXCLUDED.console_warnings,
                       network_total = EXCLUDED.network_total, network_errors = EXCLUDED.network_errors,
                       actions_total = EXCLUDED.actions_total,
                       video_file_id = coalesce(EXCLUDED.video_file_id, report_summary.video_file_id),
                       thumbnail_file_id = coalesce(EXCLUDED.thumbnail_file_id, report_summary.thumbnail_file_id),
                       updated_at = now()
                """)
                .param("rid", reportId)
                .param("duration", durationMs)
                .param("video", videoFileId)
                .param("thumb", thumbnailFileId)
                .update();
    }

    /** Report events as a ready JSON array (built by PostgreSQL). Empty kind = all. */
    public String eventsJson(UUID reportId, String kind) {
        return eventsJson(reportId, kind, true);
    }

    /** withBodies = false drops request/response bodies (public links when the admin turned them off). */
    public String eventsJson(UUID reportId, String kind, boolean withBodies) {
        return jdbc.sql("""
                SELECT coalesce(jsonb_agg(jsonb_build_object(
                           'id', id, 'kind', kind, 't', t_ms, 'ts', occurred_at, 'level', level,
                           'summary', summary, 'method', http_method, 'status', http_status,
                           'duration', duration_ms,
                           'payload', CASE WHEN :bodies THEN payload
                                           ELSE payload - 'requestBody' - 'responseBody' END) ORDER BY t_ms, id), '[]'::jsonb)::text
                  FROM report_event
                 WHERE report_id = :rid AND (:kind = '' OR kind = :kind)
                """)
                .param("rid", reportId)
                .param("kind", kind == null ? "" : kind.toUpperCase())
                .param("bodies", withBodies)
                .query(String.class)
                .single();
    }

    // ----------------------------- history -----------------------------

    public List<HistoryEntry> history(UUID entityId) {
        return jdbc.sql("""
                SELECT h.id, h.action, a.code, a.label, h.old_value::text AS old_value, h.new_value::text AS new_value,
                       h.changed_by, u.full_name, h.changed_at
                  FROM entity_history h
                  LEFT JOIN attribute a ON a.id = h.attribute_id
                  LEFT JOIN app_user u ON u.id = h.changed_by
                 WHERE h.entity_id = :id
                 ORDER BY h.id DESC
                 LIMIT 500
                """)
                .param("id", entityId)
                .query((rs, n) -> {
                    UUID by = rs.getObject("changed_by", UUID.class);
                    return new HistoryEntry(
                            rs.getObject("id", UUID.class),
                            rs.getString("action"),
                            rs.getString("code"),
                            rs.getString("label"),
                            rs.getString("old_value"),
                            rs.getString("new_value"),
                            by == null ? null : new Ref(by, rs.getString("full_name")),
                            rs.getObject("changed_at", OffsetDateTime.class));
                })
                .list();
    }
}
