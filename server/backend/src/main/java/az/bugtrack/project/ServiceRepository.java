package az.bugtrack.project;

import static az.bugtrack.project.ProjectRepository.blankToNull;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import az.bugtrack.project.ProjectDtos.ResolveResult;
import az.bugtrack.project.ProjectDtos.UrlPatternDto;
import az.bugtrack.project.UrlMatcher.Candidate;
import az.bugtrack.project.UrlMatcher.MatchType;

/** Project services and their URL patterns. */
@Repository
public class ServiceRepository {

    /** A project_service row without patterns. */
    public record ServiceRow(UUID id, UUID projectId, String code, String name, String description,
                             String environment, OffsetDateTime createdAt, OffsetDateTime archivedAt) {
    }

    public record PatternOwner(UUID patternId, UUID serviceId, UUID projectId) {
    }

    private static final String SERVICE_COLUMNS =
            "id, project_id, code, name, description, environment, created_at, archived_at";

    private final JdbcClient jdbc;

    public ServiceRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<ServiceRow> listByProject(UUID projectId, boolean includeArchived) {
        return jdbc.sql("SELECT " + SERVICE_COLUMNS + """
                 FROM project_service
                 WHERE project_id = :p AND (:all OR archived_at IS NULL)
                 ORDER BY archived_at NULLS FIRST, name
                """)
                .param("p", projectId)
                .param("all", includeArchived)
                .query(ServiceRepository::mapService)
                .list();
    }

    public Optional<ServiceRow> find(UUID id) {
        return jdbc.sql("SELECT " + SERVICE_COLUMNS + " FROM project_service WHERE id = :id")
                .param("id", id)
                .query(ServiceRepository::mapService)
                .optional();
    }

    public boolean codeExists(UUID projectId, String code) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM project_service WHERE project_id = :p AND code = :c)")
                .param("p", projectId)
                .param("c", code)
                .query(Boolean.class)
                .single();
    }

    public UUID insert(UUID projectId, String code, String name, String description, String env, UUID createdBy) {
        return jdbc.sql("""
                INSERT INTO project_service (project_id, code, name, description, environment, created_by)
                VALUES (:p, :code, :name, :description, :env, :by)
                RETURNING id
                """)
                .param("p", projectId)
                .param("code", code)
                .param("name", name.trim())
                .param("description", blankToNull(description))
                .param("env", env)
                .param("by", createdBy)
                .query(UUID.class)
                .single();
    }

    public void update(UUID id, String name, String description, String env) {
        jdbc.sql("UPDATE project_service SET name = :name, description = :description, environment = :env WHERE id = :id")
                .param("id", id)
                .param("name", name.trim())
                .param("description", blankToNull(description))
                .param("env", env)
                .update();
    }

    public void setArchived(UUID id, boolean archived) {
        jdbc.sql("UPDATE project_service SET archived_at = CASE WHEN :archived THEN now() ELSE NULL END WHERE id = :id")
                .param("id", id)
                .param("archived", archived)
                .update();
    }

    // ----------------------------- patterns -----------------------------

    public List<UrlPatternDto> patternsByProject(UUID projectId) {
        return jdbc.sql("""
                SELECT up.id, up.service_id, up.match_type, up.pattern, up.priority
                  FROM service_url_pattern up
                  JOIN project_service s ON s.id = up.service_id
                 WHERE s.project_id = :p
                 ORDER BY up.priority DESC, up.created_at
                """)
                .param("p", projectId)
                .query((rs, n) -> new UrlPatternDto(
                        rs.getObject("id", UUID.class),
                        rs.getObject("service_id", UUID.class),
                        MatchType.valueOf(rs.getString("match_type")),
                        rs.getString("pattern"),
                        rs.getInt("priority")))
                .list();
    }

    public boolean patternExists(UUID serviceId, MatchType type, String pattern) {
        return jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM service_url_pattern
                                WHERE service_id = :s AND match_type = :t AND pattern = :p)
                """)
                .param("s", serviceId)
                .param("t", type.name())
                .param("p", pattern)
                .query(Boolean.class)
                .single();
    }

    public UUID insertPattern(UUID serviceId, MatchType type, String pattern, int priority) {
        return jdbc.sql("""
                INSERT INTO service_url_pattern (service_id, match_type, pattern, priority)
                VALUES (:s, :t, :p, :prio)
                RETURNING id
                """)
                .param("s", serviceId)
                .param("t", type.name())
                .param("p", pattern)
                .param("prio", priority)
                .query(UUID.class)
                .single();
    }

    public Optional<PatternOwner> findPatternOwner(UUID patternId) {
        return jdbc.sql("""
                SELECT up.id, up.service_id, s.project_id
                  FROM service_url_pattern up
                  JOIN project_service s ON s.id = up.service_id
                 WHERE up.id = :id
                """)
                .param("id", patternId)
                .query((rs, n) -> new PatternOwner(
                        rs.getObject("id", UUID.class),
                        rs.getObject("service_id", UUID.class),
                        rs.getObject("project_id", UUID.class)))
                .optional();
    }

    public void deletePattern(UUID patternId) {
        jdbc.sql("DELETE FROM service_url_pattern WHERE id = :id").param("id", patternId).update();
    }

    /**
     * All patterns of active (not archived) services of active projects the user can see,
     * — for resolving a project from a URL.
     */
    public List<Candidate<ResolveResult>> activeCandidates(UUID me, boolean admin) {
        return jdbc.sql("""
                SELECT up.match_type, up.pattern, up.priority,
                       p.id AS project_id, p.key AS project_key, p.name AS project_name,
                       s.id AS service_id, s.code AS service_code, s.name AS service_name, s.environment,
                       ARRAY(SELECT jsonb_array_elements_text(coalesce(p.settings -> 'networkIgnore', '[]'::jsonb))) AS network_ignore,
                       (SELECT j.key FROM jira_project j WHERE j.id = p.jira_project_id) AS jira_key
                  FROM service_url_pattern up
                  JOIN project_service s ON s.id = up.service_id AND s.archived_at IS NULL
                  JOIN project p         ON p.id = s.project_id  AND p.archived_at IS NULL
                 WHERE p.visibility = 'PUBLIC' OR :admin
                    OR EXISTS (SELECT 1 FROM project_member m WHERE m.project_id = p.id AND m.user_id = :me)
                """)
                .param("me", me)
                .param("admin", admin)
                .query((rs, n) -> {
                    MatchType type = MatchType.valueOf(rs.getString("match_type"));
                    String pattern = rs.getString("pattern");
                    var result = new ResolveResult(
                            true,
                            rs.getObject("project_id", UUID.class),
                            rs.getString("project_key"),
                            rs.getString("project_name"),
                            rs.getObject("service_id", UUID.class),
                            rs.getString("service_code"),
                            rs.getString("service_name"),
                            rs.getString("environment"),
                            type,
                            pattern,
                            ProjectRepository.stringArray(rs.getArray("network_ignore")),
                            rs.getString("jira_key"));
                    return new Candidate<>(type, pattern, rs.getInt("priority"), result);
                })
                .list();
    }

    private static ServiceRow mapService(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new ServiceRow(
                rs.getObject("id", UUID.class),
                rs.getObject("project_id", UUID.class),
                rs.getString("code"),
                rs.getString("name"),
                rs.getString("description"),
                rs.getString("environment"),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("archived_at", OffsetDateTime.class));
    }
}
