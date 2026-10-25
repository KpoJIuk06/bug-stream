package az.bugtrack.project;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import az.bugtrack.project.ProjectDtos.HistoryEntry;
import az.bugtrack.project.ProjectDtos.MemberDto;
import az.bugtrack.project.ProjectDtos.MemberRole;
import az.bugtrack.project.ProjectDtos.ProjectSummary;
import az.bugtrack.project.ProjectDtos.Visibility;

@Repository
public class ProjectRepository {

    /** :me — the current user (for myRole). */
    private static final String SUMMARY_SELECT = """
            SELECT p.id, p.key, p.name, p.description, p.visibility,
                   p.created_by, u.full_name AS created_by_name,
                   p.created_at, p.updated_at, p.archived_at,
                   (SELECT count(*) FROM project_service s
                     WHERE s.project_id = p.id AND s.archived_at IS NULL)        AS services_count,
                   (SELECT count(*) FROM project_member m WHERE m.project_id = p.id) AS members_count,
                   (SELECT count(*) FROM entity e
                      JOIN entity_type t ON t.id = e.entity_type_id AND t.code = 'report'
                     WHERE e.project_id = p.id AND e.deleted_at IS NULL)         AS reports_count,
                   (SELECT m.role FROM project_member m
                     WHERE m.project_id = p.id AND m.user_id = :me)              AS my_role,
                   j.key AS jira_key, j.id AS jira_id
              FROM project p
              JOIN app_user u ON u.id = p.created_by
              LEFT JOIN jira_project j ON j.id = p.jira_project_id
            """;

    private final JdbcClient jdbc;

    public ProjectRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Projects list. PRIVATE projects are visible to members and project.view_all only
     * (PUBLIC ones to everyone).
     */
    public List<ProjectSummary> list(UUID me, boolean admin, String q, boolean includeArchived) {
        return jdbc.sql(SUMMARY_SELECT + """
                 WHERE (:includeArchived OR p.archived_at IS NULL)
                   AND (:q = '' OR p.key ILIKE '%' || :q || '%' OR p.name ILIKE '%' || :q || '%'
                        OR j.key ILIKE '%' || :q || '%' OR j.name ILIKE '%' || :q || '%' OR j.id = :q)
                   AND (p.visibility = 'PUBLIC' OR :admin
                        OR EXISTS (SELECT 1 FROM project_member m WHERE m.project_id = p.id AND m.user_id = :me))
                 ORDER BY p.archived_at NULLS FIRST, p.name
                """)
                .param("me", me)
                .param("admin", admin)
                .param("q", q == null ? "" : q.trim())
                .param("includeArchived", includeArchived)
                .query(ProjectRepository::mapSummary)
                .list();
    }

    public Optional<ProjectSummary> findSummary(UUID id, UUID me) {
        return jdbc.sql(SUMMARY_SELECT + " WHERE p.id = :id")
                .param("id", id)
                .param("me", me)
                .query(ProjectRepository::mapSummary)
                .optional();
    }

    public Optional<UUID> findIdByKey(String key) {
        return jdbc.sql("SELECT id FROM project WHERE key = :key")
                .param("key", key.toUpperCase())
                .query(UUID.class)
                .optional();
    }

    public UUID insert(String key, String name, String description, Visibility visibility, UUID createdBy) {
        return jdbc.sql("""
                INSERT INTO project (key, name, description, visibility, created_by)
                VALUES (:key, :name, :description, :visibility, :createdBy)
                RETURNING id
                """)
                .param("key", key)
                .param("name", name.trim())
                .param("description", blankToNull(description))
                .param("visibility", visibility.name())
                .param("createdBy", createdBy)
                .query(UUID.class)
                .single();
    }

    public void update(UUID id, String name, String description, Visibility visibility) {
        jdbc.sql("UPDATE project SET name = :name, description = :description, visibility = :visibility WHERE id = :id")
                .param("id", id)
                .param("name", name.trim())
                .param("description", blankToNull(description))
                .param("visibility", visibility.name())
                .update();
    }

    public void setArchived(UUID id, boolean archived) {
        jdbc.sql("UPDATE project SET archived_at = CASE WHEN :archived THEN now() ELSE NULL END WHERE id = :id")
                .param("id", id)
                .param("archived", archived)
                .update();
    }

    // ----------------------------- members -----------------------------

    public Optional<MemberRole> memberRole(UUID projectId, UUID userId) {
        return jdbc.sql("SELECT role FROM project_member WHERE project_id = :p AND user_id = :u")
                .param("p", projectId)
                .param("u", userId)
                .query(String.class)
                .optional()
                .map(MemberRole::valueOf);
    }

    public List<MemberDto> members(UUID projectId) {
        return jdbc.sql("""
                SELECT u.id, u.email, u.full_name, coalesce(r.name, u.role) AS user_role, u.is_active,
                       m.role AS project_role, m.added_at
                  FROM project_member m
                  JOIN app_user u ON u.id = m.user_id
                  LEFT JOIN app_role r ON r.code = u.role
                 WHERE m.project_id = :p
                 ORDER BY CASE m.role WHEN 'OWNER' THEN 0 WHEN 'MAINTAINER' THEN 1 WHEN 'MEMBER' THEN 2 ELSE 3 END,
                          u.full_name
                """)
                .param("p", projectId)
                .query((rs, n) -> new MemberDto(
                        rs.getObject("id", UUID.class),
                        rs.getString("email"),
                        rs.getString("full_name"),
                        rs.getString("user_role"),
                        rs.getBoolean("is_active"),
                        MemberRole.valueOf(rs.getString("project_role")),
                        rs.getObject("added_at", OffsetDateTime.class)))
                .list();
    }

    public void upsertMember(UUID projectId, UUID userId, MemberRole role, UUID addedBy) {
        jdbc.sql("""
                INSERT INTO project_member (project_id, user_id, role, added_by)
                VALUES (:p, :u, :role, :by)
                ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
                """)
                .param("p", projectId)
                .param("u", userId)
                .param("role", role.name())
                .param("by", addedBy)
                .update();
    }

    public int removeMember(UUID projectId, UUID userId) {
        return jdbc.sql("DELETE FROM project_member WHERE project_id = :p AND user_id = :u")
                .param("p", projectId)
                .param("u", userId)
                .update();
    }

    public int countOwners(UUID projectId) {
        return jdbc.sql("SELECT count(*) FROM project_member WHERE project_id = :p AND role = 'OWNER'")
                .param("p", projectId)
                .query(Integer.class)
                .single();
    }

    // ----------------------------- history -----------------------------

    public List<HistoryEntry> history(UUID projectId, int limit) {
        return jdbc.sql("""
                SELECT a.id, a.table_name, a.row_id, a.action, a.old_data::text AS old_data, a.new_data::text AS new_data,
                       a.changed_by, u.full_name AS changed_by_name, a.changed_at
                  FROM audit_log a
                  LEFT JOIN app_user u ON u.id = a.changed_by
                 WHERE a.project_id = :p
                 ORDER BY a.id DESC
                 LIMIT :limit
                """)
                .param("p", projectId)
                .param("limit", limit)
                .query((rs, n) -> new HistoryEntry(
                        rs.getObject("id", UUID.class),
                        rs.getString("table_name"),
                        rs.getObject("row_id", UUID.class),
                        rs.getString("action"),
                        rs.getString("old_data"),
                        rs.getString("new_data"),
                        rs.getObject("changed_by", UUID.class),
                        rs.getString("changed_by_name"),
                        rs.getObject("changed_at", OffsetDateTime.class)))
                .list();
    }

    // ------------------------------------------------------------------

    private static ProjectSummary mapSummary(ResultSet rs, int row) throws SQLException {
        String myRole = rs.getString("my_role");
        return new ProjectSummary(
                rs.getObject("id", UUID.class),
                rs.getString("key"),
                rs.getString("name"),
                rs.getString("description"),
                Visibility.valueOf(rs.getString("visibility")),
                rs.getObject("created_by", UUID.class),
                rs.getString("created_by_name"),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("updated_at", OffsetDateTime.class),
                rs.getObject("archived_at", OffsetDateTime.class),
                rs.getInt("services_count"),
                rs.getInt("members_count"),
                rs.getLong("reports_count"),
                myRole == null ? null : MemberRole.valueOf(myRole),
                rs.getString("jira_key"),
                rs.getString("jira_id"));
    }

    // ----------------------------- settings -----------------------------

    public List<String> networkIgnore(UUID projectId) {
        return jdbc.sql("""
                SELECT ARRAY(SELECT jsonb_array_elements_text(coalesce(settings -> 'networkIgnore', '[]'::jsonb)))
                  FROM project WHERE id = :id
                """)
                .param("id", projectId)
                .query((rs, n) -> stringArray(rs.getArray(1)))
                .optional()
                .orElse(List.of());
    }

    public void setNetworkIgnore(UUID projectId, List<String> patterns) {
        jdbc.sql("UPDATE project SET settings = jsonb_set(settings, '{networkIgnore}', CAST(:json AS jsonb)) WHERE id = :id")
                .param("id", projectId)
                .param("json", toJsonArray(patterns))
                .update();
    }

    static List<String> stringArray(java.sql.Array arr) throws SQLException {
        if (arr == null) return List.of();
        Object[] values = (Object[]) arr.getArray();
        return java.util.Arrays.stream(values).map(String::valueOf).toList();
    }

    static String toJsonArray(List<String> values) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) sb.append(',');
            sb.append('"');
            for (char c : values.get(i).toCharArray()) {
                switch (c) {
                    case '"' -> sb.append("\\\"");
                    case '\\' -> sb.append("\\\\");
                    default -> {
                        if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                        else sb.append(c);
                    }
                }
            }
            sb.append('"');
        }
        return sb.append(']').toString();
    }

    static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
