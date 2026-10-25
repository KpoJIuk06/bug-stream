package az.bugtrack.report;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonRawValue;

import az.bugtrack.storage.FileDto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class ReportDtos {

    private ReportDtos() {
    }

    // ----------------------------- upload from the extension -----------------------------

    /**
     * The "meta" part of the multipart request POST /api/reports (application/json).
     * Without projectId the project/service are resolved from pageUrl by URL patterns.
     */
    public record ReportMeta(
            @NotBlank @Size(max = 500) String title,
            String description,
            UUID projectId,
            UUID serviceId,
            String severity,
            List<String> tags,
            String source,                 // EXTENSION | SCREENSHOT | REPLAY | WIDGET | API (EXTENSION by default)
            @NotBlank @Size(max = 2048) String pageUrl,
            String pageTitle,
            OffsetDateTime recordedAt,
            Integer durationMs,
            String timezone,
            String locale,
            String location,
            String os,
            String osVersion,
            String browser,
            String browserVersion,
            String windowSize,
            String screenSize,
            Double devicePixelRatio,
            String networkType,
            Double networkDownlink,
            Integer networkRtt,
            String extensionVersion,
            String reporterEmail,          // widget: e-mail of the person on the site (if it matches a user, they become the author)
            String reporterName,
            String environment) {          // environment code; empty = the service's environment
    }

    // ----------------------------- changes -----------------------------

    /**
     * PATCH /api/reports/{id}. fields: attribute codes, {"status":"IN_PROGRESS","tags":["ui"],"assignee_id":null}.
     * projectId/serviceId: move the report (optional; serviceId must belong to the project).
     */
    public record UpdateReportRequest(Map<String, Object> fields, UUID projectId, UUID serviceId,
                                      Boolean clearProject) {
    }

    // ----------------------------- responses -----------------------------

    public record Ref(UUID id, String name) {
    }

    public record ProjectRef(UUID id, String key, String name) {
    }

    public record ReportListItem(
            UUID id,
            ProjectRef project,
            Ref service,
            Ref author,
            Ref assignee,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt,
            String title,
            String status,
            String severity,
            String environment,
            String pageUrl,
            String browser,
            String os,
            int durationMs,
            int consoleErrors,
            int networkErrors,
            long commentsCount,
            String thumbnailUrl,
            List<String> tags,
            JiraRef jira) {
    }

    public record Page<T>(List<T> items, int page, int size, long total) {
    }

    public record Summary(int durationMs, int eventsTotal, int consoleErrors, int consoleWarnings,
                          int networkTotal, int networkErrors, int actionsTotal) {
    }

    public record ReportDetails(
            UUID id,
            ProjectRef project,
            Ref service,
            Ref author,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt,
            OffsetDateTime deletedAt,
            @JsonRawValue String fields,      // {"title": "...", "status": "NEW", "tags": [...], "os": "Windows", ...}
            Summary summary,
            List<FileDto> files,
            boolean canDelete,
            boolean canEdit) {
    }

    public record HistoryEntry(
            UUID id,
            String action,
            String field,
            String fieldLabel,
            @JsonRawValue String oldValue,
            @JsonRawValue String newValue,
            Ref changedBy,
            OffsetDateTime changedAt) {
    }

    /** List filters, all optional. */
    public record ReportFilter(
            UUID projectId,
            UUID serviceId,
            List<String> status,
            List<String> severity,
            List<String> environment,
            UUID authorId,
            UUID assigneeId,
            List<String> tag,
            Boolean hasErrors,
            OffsetDateTime from,
            OffsetDateTime to,
            String q,
            boolean includeDeleted,
            String sort,           // newest (default) | oldest | updated
            int page,
            int size,
            UUID viewerId,         // who is looking — for PRIVATE projects
            boolean viewerSeesAll,
            List<String> jira,     // NONE (not sent) | TODO | IN_PROGRESS | DONE — Jira status category
            boolean noProject) {   // only reports without a project
    }

    /** The report's Jira issue (the latest one) with its status from the background sync. */
    public record JiraRef(String key, String url, String status, String category) {
    }

    /** All reports → grouped by project: one row per project with counters and the latest previews. */
    public record ProjectGroup(
            ProjectRef project,       // null — reports without a project
            String jiraProjectKey,
            long total,
            long newCount,
            long inProgress,
            long done,                // RESOLVED, CLOSED, REJECTED
            long withErrors,
            long critical,            // HIGH + CRITICAL not done
            long inJira,
            long jiraDone,
            OffsetDateTime lastAt,
            List<String> thumbnails) {
    }
}
