package az.bugtrack.jira;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import az.bugtrack.jira.JiraClient.Myself;
import az.bugtrack.jira.JiraRepository.ExternalLink;
import az.bugtrack.jira.JiraRepository.JiraProjectRow;
import az.bugtrack.jira.JiraService.ConnectResult;
import az.bugtrack.jira.JiraService.ConnectionRequest;
import az.bugtrack.jira.JiraService.MyJira;
import az.bugtrack.jira.JiraService.Status;
import az.bugtrack.jira.JiraService.SyncResult;
import az.bugtrack.security.AuthUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

@RestController
public class JiraController {

    public record ConnectRequest(@NotEmpty @Size(max = 500) List<String> jiraProjectIds) {
    }

    public record ProjectLinkRequest(String jiraProjectId, String issueType) {
    }

    public record TokenRequest(String email, String token) {
    }

    public record SendRequest(String issueType) {
    }

    /** projectIds empty or missing = all linked projects; issueType empty = back to the default. */
    public record BulkIssueTypeRequest(List<UUID> projectIds, String issueType) {
    }

    public record BulkResult(int updated) {
    }

    private final JiraService service;

    public JiraController(JiraService service) {
        this.service = service;
    }

    // ----------------------------- admin -----------------------------

    @GetMapping("/api/admin/jira")
    @PreAuthorize("hasAuthority('integration.manage')")
    public Status status() {
        return service.status();
    }

    @PutMapping("/api/admin/jira")
    @PreAuthorize("hasAuthority('integration.manage')")
    public Status save(@AuthenticationPrincipal AuthUser me, @RequestBody ConnectionRequest req) {
        return service.saveConnection(me, req);
    }

    @DeleteMapping("/api/admin/jira")
    @PreAuthorize("hasAuthority('integration.manage')")
    public ResponseEntity<Void> delete() {
        service.deleteConnection();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/admin/jira/test")
    @PreAuthorize("hasAuthority('integration.manage')")
    public Myself test() {
        return service.testConnection();
    }

    @PostMapping("/api/admin/jira/sync")
    @PreAuthorize("hasAuthority('integration.manage')")
    public SyncResult sync() {
        return service.sync();
    }

    /** filter: all | linked | unlinked */
    @GetMapping("/api/admin/jira/projects")
    @PreAuthorize("hasAuthority('integration.manage')")
    public List<JiraProjectRow> projects(@RequestParam(defaultValue = "") String q,
                                         @RequestParam(defaultValue = "all") String filter) {
        return service.jiraProjects(q, filter);
    }

    @PostMapping("/api/admin/jira/projects/connect")
    @PreAuthorize("hasAuthority('integration.manage')")
    public List<ConnectResult> connect(@AuthenticationPrincipal AuthUser me, @Valid @RequestBody ConnectRequest req) {
        return service.connect(me, req.jiraProjectIds());
    }

    /** Issue type names across the synced projects (default type picker). */
    @GetMapping("/api/admin/jira/issue-types")
    @PreAuthorize("hasAuthority('integration.manage')")
    public List<JiraService.IssueTypeUsage> issueTypes() {
        return service.issueTypeUsage();
    }

    /** Linked projects with the issue type each one will use. */
    @GetMapping("/api/admin/jira/linked")
    @PreAuthorize("hasAuthority('integration.manage')")
    public List<JiraService.LinkedProject> linked(@RequestParam(defaultValue = "") String q) {
        return service.linkedProjects(q);
    }

    @PutMapping("/api/admin/jira/linked/issue-type")
    @PreAuthorize("hasAuthority('integration.manage')")
    public BulkResult bulkIssueType(@RequestBody BulkIssueTypeRequest req) {
        List<UUID> ids = req.projectIds() == null || req.projectIds().isEmpty() ? null : req.projectIds();
        return new BulkResult(service.setIssueTypes(ids, req.issueType()));
    }

    /** Re-reads the issue types of a Jira project from Jira. */
    @PostMapping("/api/jira/projects/{jiraProjectId}/issue-types/refresh")
    public List<JiraClient.IssueType> refreshTypes(@AuthenticationPrincipal AuthUser me, @PathVariable String jiraProjectId) {
        return service.refreshIssueTypes(me, jiraProjectId);
    }

    /** Project → Jira & Slack: link, issue types and the type that will be used. */
    @GetMapping("/api/projects/{id}/jira")
    public JiraService.ProjectJira projectJira(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return service.projectJira(me, id);
    }

    /** Synced Jira projects for the project page picker (project managers link their own project). */
    @GetMapping("/api/jira/projects")
    public List<JiraProjectRow> projectsForPicker(@RequestParam(defaultValue = "") String q) {
        return service.jiraProjects(q, "all");
    }

    @PutMapping("/api/projects/{id}/jira")
    public ResponseEntity<Void> link(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id,
                                     @RequestBody ProjectLinkRequest req) {
        service.setProjectLink(me, id, req.jiraProjectId() == null || req.jiraProjectId().isBlank() ? null : req.jiraProjectId(),
                req.issueType());
        return ResponseEntity.noContent().build();
    }

    // ----------------------------- my token -----------------------------

    @GetMapping("/api/me/jira")
    public MyJira my(@AuthenticationPrincipal AuthUser me) {
        return service.my(me);
    }

    @PutMapping("/api/me/jira")
    public MyJira saveToken(@AuthenticationPrincipal AuthUser me, @RequestBody TokenRequest req) {
        return service.saveMyToken(me, req.email(), req.token());
    }

    @DeleteMapping("/api/me/jira")
    public ResponseEntity<Void> deleteToken(@AuthenticationPrincipal AuthUser me) {
        service.deleteMyToken(me);
        return ResponseEntity.noContent().build();
    }

    // ----------------------------- reports -----------------------------

    @PostMapping("/api/reports/{reportId}/jira")
    public ExternalLink send(@AuthenticationPrincipal AuthUser me, @PathVariable UUID reportId,
                             @RequestBody(required = false) SendRequest req) {
        return service.send(me, reportId, req == null ? null : req.issueType());
    }

    /** Old path used by extension 0.3 ("Send to app"); the body is ignored. */
    @PostMapping("/api/reports/{reportId}/send")
    public ExternalLink sendLegacy(@AuthenticationPrincipal AuthUser me, @PathVariable UUID reportId) {
        return service.send(me, reportId, null);
    }

    /** Reads the Jira status of the report's issues now (instead of waiting for the background sync). */
    @PostMapping("/api/reports/{reportId}/links/refresh")
    public List<ExternalLink> refreshLinks(@AuthenticationPrincipal AuthUser me, @PathVariable UUID reportId) {
        return service.refreshStatus(me, reportId);
    }

    @GetMapping("/api/reports/{reportId}/links")
    public List<ExternalLink> links(@AuthenticationPrincipal AuthUser me, @PathVariable UUID reportId) {
        return service.links(me, reportId);
    }
}
