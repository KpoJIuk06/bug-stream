package az.bugtrack.report;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import az.bugtrack.notification.NotificationService;
import az.bugtrack.access.Permissions;
import az.bugtrack.report.ReportDtos.HistoryEntry;
import az.bugtrack.report.ReportDtos.Page;
import az.bugtrack.report.ReportDtos.ReportDetails;
import az.bugtrack.report.ReportDtos.ProjectGroup;
import az.bugtrack.report.ReportDtos.ReportFilter;
import az.bugtrack.report.ReportDtos.ReportListItem;
import az.bugtrack.report.ReportDtos.ReportMeta;
import az.bugtrack.report.ReportDtos.UpdateReportRequest;
import az.bugtrack.security.AuthUser;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService service;
    private final NotificationService notifications;

    public ReportController(ReportService service, NotificationService notifications) {
        this.service = service;
        this.notifications = notifications;
    }

    /**
     * Report upload from the extension — multipart/form-data:
     *   meta       (application/json, required) — ReportMeta
     *   events     (application/json, optional) — array of events
     *   video      (video/webm), screenshot (image/png), thumbnail (image/jpeg) — optional
     *   replay     (application/gzip — rrweb DOM recording for instant replay) — optional
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ReportDetails create(@AuthenticationPrincipal AuthUser me,
                                @Valid @RequestPart("meta") ReportMeta meta,
                                @RequestPart(value = "events", required = false) String events,
                                @RequestPart(value = "video", required = false) MultipartFile video,
                                @RequestPart(value = "screenshot", required = false) MultipartFile screenshot,
                                @RequestPart(value = "thumbnail", required = false) MultipartFile thumbnail,
                                @RequestPart(value = "replay", required = false) MultipartFile replay) {
        return service.create(me, meta, events, video, screenshot, thumbnail, replay);
    }

    @GetMapping
    public Page<ReportListItem> list(
            @AuthenticationPrincipal AuthUser me,
            @RequestParam(required = false) UUID projectId,
            @RequestParam(required = false) UUID serviceId,
            @RequestParam(required = false) List<String> status,
            @RequestParam(required = false) List<String> severity,
            @RequestParam(required = false) List<String> environment,
            @RequestParam(required = false) UUID authorId,
            @RequestParam(required = false) UUID assigneeId,
            @RequestParam(required = false) List<String> tag,
            @RequestParam(required = false) Boolean hasErrors,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "false") boolean includeDeleted,
            @RequestParam(defaultValue = "newest") String sort,
            @RequestParam(required = false) List<String> jira,
            @RequestParam(defaultValue = "false") boolean noProject,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        var filter = new ReportFilter(projectId, serviceId, status, severity, environment, authorId, assigneeId, tag, hasErrors,
                from, to, q, includeDeleted, sort, Math.max(page, 0), Math.clamp(size, 1, 100), me.id(),
                me.has(Permissions.PROJECT_VIEW_ALL), jira, noProject);
        return service.list(filter);
    }

    /** The same filters, grouped by project (All reports → "By project"). */
    @GetMapping("/groups")
    public List<ProjectGroup> groups(
            @AuthenticationPrincipal AuthUser me,
            @RequestParam(required = false) List<String> status,
            @RequestParam(required = false) List<String> severity,
            @RequestParam(required = false) List<String> environment,
            @RequestParam(required = false) UUID authorId,
            @RequestParam(required = false) UUID assigneeId,
            @RequestParam(required = false) List<String> tag,
            @RequestParam(required = false) Boolean hasErrors,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) List<String> jira) {
        var filter = new ReportFilter(null, null, status, severity, environment, authorId, assigneeId, tag, hasErrors,
                from, to, q, false, "newest", 0, 1, me.id(), me.has(Permissions.PROJECT_VIEW_ALL), jira, false);
        return service.groups(filter);
    }

    @GetMapping("/{id}")
    public ReportDetails get(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        ReportDetails details = service.details(me, id);
        notifications.markReportRead(id, me.id());   // opening a report marks its notifications as read
        return details;
    }

    /** Events for the Console / Network / Actions tabs. kind: console|network|action|navigation|custom. */
    @GetMapping(value = "/{id}/events", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> events(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id,
                                         @RequestParam(required = false) String kind) {
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(service.events(me, id, kind));
    }

    @PatchMapping("/{id}")
    public ReportDetails update(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id,
                                @RequestBody UpdateReportRequest req) {
        return service.update(me, id, req);
    }

    @DeleteMapping("/{id}")
    public ReportDetails delete(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return service.setDeleted(me, id, true);
    }

    @PostMapping("/{id}/restore")
    public ReportDetails restore(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return service.setDeleted(me, id, false);
    }

    @GetMapping("/{id}/history")
    public List<HistoryEntry> history(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return service.history(me, id);
    }
}
