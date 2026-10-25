package az.bugtrack.jira;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.fasterxml.jackson.annotation.JsonRawValue;

import az.bugtrack.jira.JiraClient.RemoteProject;
import tools.jackson.databind.ObjectMapper;

@Repository
public class JiraRepository {

    public record Connection(String baseUrl, String serviceEmail, String serviceTokenEnc, String defaultIssueType,
                             String environmentField, OffsetDateTime lastSyncAt, String lastSyncError,
                             OffsetDateTime updatedAt, OffsetDateTime statusSyncAt, String statusSyncError) {
    }

    /** A Jira project from the last sync, with the Bug Stream project linked to it (if any). */
    public record JiraProjectRow(String id, String key, String name, String projectType, String avatarUrl,
                                 @JsonRawValue String issueTypes, OffsetDateTime syncedAt, OffsetDateTime removedAt,
                                 UUID linkedProjectId, String linkedProjectKey, String linkedProjectName,
                                 String linkedIssueType) {
    }

    public record UserToken(UUID userId, String jiraEmail, String tokenEnc, String accountId, String displayName,
                            OffsetDateTime verifiedAt, OffsetDateTime invalidAt) {
    }

    /** Bug Stream project ↔ Jira project. */
    public record ProjectLink(UUID projectId, String jiraProjectId, String jiraProjectKey, String issueType,
                              @JsonRawValue String issueTypes) {
    }

    /** statusCategory: new | indeterminate | done; null until the first status sync. */
    public record ExternalLink(UUID id, String type, String externalKey, String externalUrl, String createdByName,
                               OffsetDateTime createdAt, String statusName, String statusCategory,
                               OffsetDateTime statusSyncedAt, OffsetDateTime missingAt) {
    }

    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public JiraRepository(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    // ----------------------------- connection -----------------------------

    public Optional<Connection> connection() {
        return jdbc.sql("""
                SELECT base_url, service_email, service_token_enc, default_issue_type, environment_field,
                       last_sync_at, last_sync_error, updated_at, status_sync_at, status_sync_error
                  FROM jira_connection WHERE id = 1
                """)
                .query((rs, i) -> new Connection(rs.getString("base_url"), rs.getString("service_email"),
                        rs.getString("service_token_enc"), rs.getString("default_issue_type"),
                        rs.getString("environment_field"), rs.getObject("last_sync_at", OffsetDateTime.class),
                        rs.getString("last_sync_error"), rs.getObject("updated_at", OffsetDateTime.class),
                        rs.getObject("status_sync_at", OffsetDateTime.class), rs.getString("status_sync_error")))
                .optional();
    }

    public void saveConnection(String baseUrl, String email, String tokenEnc, String issueType, String envField,
                               UUID by) {
        jdbc.sql("""
                INSERT INTO jira_connection (id, base_url, service_email, service_token_enc, default_issue_type,
                                             environment_field, updated_by)
                VALUES (1, :url, :email, :token, :type, :env, :by)
                ON CONFLICT (id) DO UPDATE
                   SET base_url = EXCLUDED.base_url, service_email = EXCLUDED.service_email,
                       service_token_enc = EXCLUDED.service_token_enc,
                       default_issue_type = EXCLUDED.default_issue_type,
                       environment_field = EXCLUDED.environment_field, updated_by = EXCLUDED.updated_by
                """)
                .param("url", baseUrl)
                .param("email", email)
                .param("token", tokenEnc)
                .param("type", issueType)
                .param("env", envField)
                .param("by", by)
                .update();
    }

    public void deleteConnection() {
        jdbc.sql("DELETE FROM jira_connection").update();
    }

    public void syncResult(String error) {
        jdbc.sql("UPDATE jira_connection SET last_sync_at = now(), last_sync_error = :err WHERE id = 1")
                .param("err", error)
                .update();
    }

    // ----------------------------- Jira projects -----------------------------

    /** Upserts the projects from Jira and marks the ones that disappeared. Returns how many are new. */
    public int upsertProjects(List<RemoteProject> projects) {
        int added = 0;
        for (RemoteProject p : projects) {
            int inserted = jdbc.sql("""
                    INSERT INTO jira_project (id, key, name, project_type, avatar_url, issue_types, synced_at)
                    VALUES (:id, :key, :name, :type, :avatar, CAST(:types AS jsonb), now())
                    ON CONFLICT (id) DO NOTHING
                    """)
                    .param("id", p.id())
                    .param("key", p.key())
                    .param("name", p.name())
                    .param("type", p.projectType())
                    .param("avatar", p.avatarUrl())
                    .param("types", json.writeValueAsString(p.issueTypes()))
                    .update();
            if (inserted == 0) {
                jdbc.sql("""
                        UPDATE jira_project SET key = :key, name = :name, project_type = :type, avatar_url = :avatar,
                               issue_types = CAST(:types AS jsonb), synced_at = now(), removed_at = NULL
                         WHERE id = :id
                        """)
                        .param("id", p.id())
                        .param("key", p.key())
                        .param("name", p.name())
                        .param("type", p.projectType())
                        .param("avatar", p.avatarUrl())
                        .param("types", json.writeValueAsString(p.issueTypes()))
                        .update();
            } else {
                added++;
            }
        }
        String[] ids = projects.stream().map(RemoteProject::id).toArray(String[]::new);
        jdbc.sql("UPDATE jira_project SET removed_at = now() WHERE removed_at IS NULL AND NOT (id = ANY(:ids))")
                .param("ids", ids)
                .update();
        return added;
    }

    /** Frees the key of a Jira project that was deleted so a new one can take it. */
    public void clearConflictingKeys(List<RemoteProject> projects) {
        for (RemoteProject p : projects) {
            jdbc.sql("UPDATE jira_project SET key = key || '~' || id WHERE key = :key AND id <> :id")
                    .param("key", p.key())
                    .param("id", p.id())
                    .update();
        }
    }

    public List<JiraProjectRow> projects(String q, String filter) {
        return jdbc.sql("""
                SELECT j.id, j.key, j.name, j.project_type, j.avatar_url, j.issue_types::text AS issue_types,
                       j.synced_at, j.removed_at, p.id AS project_id, p.key AS project_key, p.name AS project_name,
                       p.jira_issue_type
                  FROM jira_project j
                  LEFT JOIN project p ON p.jira_project_id = j.id
                 WHERE (:q = '' OR j.key ILIKE '%' || :q || '%' OR j.name ILIKE '%' || :q || '%' OR j.id = :q)
                   AND (:filter = 'all'
                        OR (:filter = 'linked' AND p.id IS NOT NULL)
                        OR (:filter = 'unlinked' AND p.id IS NULL AND j.removed_at IS NULL))
                 ORDER BY (p.id IS NULL), j.key
                """)
                .param("q", q == null ? "" : q.trim())
                .param("filter", filter == null ? "all" : filter)
                .query((rs, i) -> new JiraProjectRow(rs.getString("id"), rs.getString("key"), rs.getString("name"),
                        rs.getString("project_type"), rs.getString("avatar_url"), rs.getString("issue_types"),
                        rs.getObject("synced_at", OffsetDateTime.class), rs.getObject("removed_at", OffsetDateTime.class),
                        rs.getObject("project_id", UUID.class), rs.getString("project_key"),
                        rs.getString("project_name"), rs.getString("jira_issue_type")))
                .list();
    }

    public Optional<JiraProjectRow> project(String id) {
        return projects("", "all").stream().filter(p -> p.id().equals(id)).findFirst();
    }

    public Optional<ProjectLink> link(UUID projectId) {
        return jdbc.sql("""
                SELECT p.id, j.id AS jira_id, j.key AS jira_key, p.jira_issue_type, j.issue_types::text AS issue_types
                  FROM project p JOIN jira_project j ON j.id = p.jira_project_id
                 WHERE p.id = :p
                """)
                .param("p", projectId)
                .query((rs, i) -> new ProjectLink(rs.getObject("id", UUID.class), rs.getString("jira_id"),
                        rs.getString("jira_key"), rs.getString("jira_issue_type"), rs.getString("issue_types")))
                .optional();
    }

    public void setProjectLink(UUID projectId, String jiraProjectId, String issueType) {
        jdbc.sql("UPDATE project SET jira_project_id = :j, jira_issue_type = :t WHERE id = :p")
                .param("p", projectId)
                .param("j", jiraProjectId)
                .param("t", issueType)
                .update();
    }

    /** Issue types loaded from Jira for one project. */
    public void setIssueTypes(String jiraProjectId, String typesJson) {
        jdbc.sql("UPDATE jira_project SET issue_types = CAST(:t AS jsonb), synced_at = now() WHERE id = :id")
                .param("id", jiraProjectId).param("t", typesJson).update();
    }

    /** Bulk: the same issue type (or null = the default) for many linked projects; null ids = all linked. */
    public int setIssueTypeForProjects(List<UUID> projectIds, String issueType) {
        if (projectIds == null) {
            return jdbc.sql("UPDATE project SET jira_issue_type = :t WHERE jira_project_id IS NOT NULL")
                    .param("t", issueType).update();
        }
        if (projectIds.isEmpty()) return 0;
        return jdbc.sql("UPDATE project SET jira_issue_type = :t WHERE jira_project_id IS NOT NULL AND id IN (:ids)")
                .param("t", issueType).param("ids", projectIds).update();
    }

    // ----------------------------- issue statuses -----------------------------

    /** Keys of Jira links that never got a status yet (just created, or created before V14). */
    public List<String> unsyncedKeys(int limit) {
        return jdbc.sql("""
                SELECT DISTINCT upper(external_key) FROM report_external_link
                 WHERE type = 'JIRA' AND status_synced_at IS NULL AND missing_at IS NULL
                 LIMIT :limit
                """)
                .param("limit", limit)
                .query(String.class)
                .list();
    }

    /** Stores the status on every link to this issue; returns how many links changed status. */
    public int updateStatus(String key, String name, String category) {
        int changed = jdbc.sql("""
                UPDATE report_external_link SET status_name = :name, status_category = :cat
                 WHERE type = 'JIRA' AND upper(external_key) = upper(:key)
                   AND (status_name IS DISTINCT FROM :name OR status_category IS DISTINCT FROM :cat)
                """)
                .param("key", key).param("name", name).param("cat", category).update();
        jdbc.sql("""
                UPDATE report_external_link SET status_synced_at = now(), missing_at = NULL
                 WHERE type = 'JIRA' AND upper(external_key) = upper(:key)
                """)
                .param("key", key).update();
        return changed;
    }

    public void markMissing(String key) {
        jdbc.sql("""
                UPDATE report_external_link SET missing_at = now(), status_synced_at = now()
                 WHERE type = 'JIRA' AND upper(external_key) = upper(:key)
                """)
                .param("key", key).update();
    }

    public Optional<OffsetDateTime> statusSyncAt() {
        return jdbc.sql("SELECT status_sync_at FROM jira_connection WHERE id = 1")
                .query((rs, i) -> Optional.ofNullable(rs.getObject("status_sync_at", OffsetDateTime.class)))
                .optional().flatMap(x -> x);
    }

    public void statusSyncResult(OffsetDateTime startedAt, String error) {
        if (error == null) {
            jdbc.sql("UPDATE jira_connection SET status_sync_at = :at, status_sync_error = NULL WHERE id = 1")
                    .param("at", startedAt).update();
        } else {
            jdbc.sql("UPDATE jira_connection SET status_sync_error = :err WHERE id = 1").param("err", error).update();
        }
    }

    public Optional<UUID> projectByJira(String jiraProjectId) {
        return jdbc.sql("SELECT id FROM project WHERE jira_project_id = :j")
                .param("j", jiraProjectId)
                .query(UUID.class)
                .optional();
    }

    // ----------------------------- personal tokens -----------------------------

    public Optional<UserToken> token(UUID userId) {
        return jdbc.sql("""
                SELECT user_id, jira_email, token_enc, jira_account_id, jira_display_name, verified_at, invalid_at
                  FROM user_jira_token WHERE user_id = :u
                """)
                .param("u", userId)
                .query((rs, i) -> new UserToken(rs.getObject("user_id", UUID.class), rs.getString("jira_email"),
                        rs.getString("token_enc"), rs.getString("jira_account_id"), rs.getString("jira_display_name"),
                        rs.getObject("verified_at", OffsetDateTime.class), rs.getObject("invalid_at", OffsetDateTime.class)))
                .optional();
    }

    public void saveToken(UUID userId, String email, String tokenEnc, String accountId, String displayName) {
        jdbc.sql("""
                INSERT INTO user_jira_token (user_id, jira_email, token_enc, jira_account_id, jira_display_name,
                                             verified_at, invalid_at)
                VALUES (:u, :email, :token, :account, :name, now(), NULL)
                ON CONFLICT (user_id) DO UPDATE
                   SET jira_email = EXCLUDED.jira_email, token_enc = EXCLUDED.token_enc,
                       jira_account_id = EXCLUDED.jira_account_id, jira_display_name = EXCLUDED.jira_display_name,
                       verified_at = now(), invalid_at = NULL
                """)
                .param("u", userId)
                .param("email", email)
                .param("token", tokenEnc)
                .param("account", accountId)
                .param("name", displayName)
                .update();
    }

    public void markTokenInvalid(UUID userId) {
        jdbc.sql("UPDATE user_jira_token SET invalid_at = now() WHERE user_id = :u AND invalid_at IS NULL")
                .param("u", userId)
                .update();
    }

    public void deleteToken(UUID userId) {
        jdbc.sql("DELETE FROM user_jira_token WHERE user_id = :u").param("u", userId).update();
    }

    public long tokensCount() {
        return jdbc.sql("SELECT count(*) FROM user_jira_token WHERE invalid_at IS NULL").query(Long.class).single();
    }

    // ----------------------------- issue links -----------------------------

    public void insertLink(UUID reportId, String key, String url, UUID createdBy) {
        jdbc.sql("""
                INSERT INTO report_external_link (report_id, type, external_key, external_url, created_by)
                VALUES (:r, 'JIRA', :key, :url, :by)
                """)
                .param("r", reportId)
                .param("key", key)
                .param("url", url)
                .param("by", createdBy)
                .update();
    }

    public List<ExternalLink> links(UUID reportId) {
        return jdbc.sql("""
                SELECT l.id, l.type, l.external_key, l.external_url, u.full_name, l.created_at,
                       l.status_name, l.status_category, l.status_synced_at, l.missing_at
                  FROM report_external_link l
                  LEFT JOIN app_user u ON u.id = l.created_by
                 WHERE l.report_id = :r
                 ORDER BY l.id
                """)
                .param("r", reportId)
                .query((rs, n) -> new ExternalLink(rs.getObject("id", UUID.class), rs.getString("type"),
                        rs.getString("external_key"), rs.getString("external_url"), rs.getString("full_name"),
                        rs.getObject("created_at", OffsetDateTime.class), rs.getString("status_name"),
                        rs.getString("status_category"), rs.getObject("status_synced_at", OffsetDateTime.class),
                        rs.getObject("missing_at", OffsetDateTime.class)))
                .list();
    }

    // ----------------------------- report data for an issue -----------------------------

    /** Text values of the report fields (title, description, page_url, browser, os ...). */
    public Map<String, String> reportFields(UUID reportId) {
        Map<String, String> out = new LinkedHashMap<>();
        jdbc.sql("""
                SELECT a.code, string_agg(entity_value_json(v) #>> '{}', ', ' ORDER BY v.idx) AS value
                  FROM entity_value v JOIN attribute a ON a.id = v.attribute_id
                 WHERE v.entity_id = :r
                 GROUP BY a.code
                """)
                .param("r", reportId)
                .query((rs, n) -> out.put(rs.getString("code"), rs.getString("value")))
                .list();
        return out;
    }

    /** Console and network errors — the earliest first. */
    public List<String> reportErrors(UUID reportId, int limit) {
        return jdbc.sql("""
                SELECT CASE WHEN kind = 'CONSOLE' THEN 'Console: ' ELSE 'Network: ' END || summary
                  FROM report_event
                 WHERE report_id = :r
                   AND ((kind = 'CONSOLE' AND level = 'error')
                        OR (kind = 'NETWORK' AND (http_status >= 400 OR http_status = 0)))
                 ORDER BY t_ms
                 LIMIT :limit
                """)
                .param("r", reportId)
                .param("limit", limit)
                .query(String.class)
                .list();
    }
}
