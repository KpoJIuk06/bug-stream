package az.bugtrack.project;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import az.bugtrack.project.UrlMatcher.MatchType;
import com.fasterxml.jackson.annotation.JsonRawValue;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class ProjectDtos {

    private ProjectDtos() {
    }

    public enum Visibility { PUBLIC, PRIVATE }

    public enum MemberRole { OWNER, MAINTAINER, MEMBER, VIEWER }

    // ----------------------------- responses -----------------------------

    public record ProjectSummary(
            UUID id,
            String key,
            String name,
            String description,
            Visibility visibility,
            UUID createdBy,
            String createdByName,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt,
            OffsetDateTime archivedAt,
            int servicesCount,
            int membersCount,
            long reportsCount,
            MemberRole myRole,
            String jiraProjectKey,          // linked Jira project (Admin → Jira)
            String jiraProjectId) {
    }

    public record ProjectDetails(
            ProjectSummary project,
            List<ServiceDto> services,
            boolean canManage,
            List<String> networkIgnore) {
    }

    /** PUT /api/projects/{id}/settings. networkIgnore: substrings or * patterns: "collector.github.com", "*\/telemetry*". */
    public record ProjectSettingsRequest(List<@NotBlank @Size(max = 300) String> networkIgnore) {
    }

    public record ServiceDto(
            UUID id,
            UUID projectId,
            String code,
            String name,
            String description,
            String environment,
            OffsetDateTime createdAt,
            OffsetDateTime archivedAt,
            List<UrlPatternDto> patterns) {
    }

    public record UrlPatternDto(UUID id, UUID serviceId, MatchType matchType, String pattern, int priority) {
    }

    public record MemberDto(
            UUID userId,
            String email,
            String fullName,
            String userRole,               // role name (e.g. "QA engineer")
            boolean userActive,
            MemberRole projectRole,
            OffsetDateTime addedAt) {
    }

    /** Project history entry (from audit_log). oldData/newData: JSON of the changed fields only. */
    public record HistoryEntry(
            UUID id,
            String tableName,
            UUID rowId,
            String action,
            @JsonRawValue String oldData,
            @JsonRawValue String newData,
            UUID changedBy,
            String changedByName,
            OffsetDateTime changedAt) {
    }

    /** Project resolved from a page URL (for the extension). */
    public record ResolveResult(
            boolean matched,
            UUID projectId,
            String projectKey,
            String projectName,
            UUID serviceId,
            String serviceCode,
            String serviceName,
            String environment,
            MatchType matchType,
            String pattern,
            List<String> networkIgnore,      // requests not to record (project setting)
            String jiraProjectKey) {         // linked Jira project, null = cannot send to Jira

        public static ResolveResult none() {
            return new ResolveResult(false, null, null, null, null, null, null, null, null, null, List.of(), null);
        }
    }

    // ----------------------------- requests -----------------------------

    public record CreateProjectRequest(
            @NotBlank @Pattern(regexp = "^[A-Z][A-Z0-9_]{1,19}$",
                    message = "2–20 chars: uppercase latin letters, digits, underscore; starts with a letter")
            String key,
            @NotBlank @Size(max = 200) String name,
            @Size(max = 5000) String description,
            Visibility visibility) {
    }

    public record UpdateProjectRequest(
            @NotBlank @Size(max = 200) String name,
            @Size(max = 5000) String description,
            @NotNull Visibility visibility) {
    }

    public record SetMemberRequest(@NotNull MemberRole role) {
    }

    public record CreateServiceRequest(
            @NotBlank @Pattern(regexp = "^[a-z0-9][a-z0-9_-]{1,49}$",
                    message = "2–50 chars: lowercase latin letters, digits, '-' or '_'")
            String code,
            @NotBlank @Size(max = 200) String name,
            @Size(max = 5000) String description,
            String environment,
            List<@Valid CreatePatternRequest> patterns) {
    }

    public record UpdateServiceRequest(
            @NotBlank @Size(max = 200) String name,
            @Size(max = 5000) String description,
            @NotBlank @Size(max = 20) String environment) {
    }

    public record CreatePatternRequest(
            @NotNull MatchType matchType,
            @NotBlank @Size(max = 1000) String pattern,
            @Min(-1000) @Max(1000) Integer priority) {
    }
}
