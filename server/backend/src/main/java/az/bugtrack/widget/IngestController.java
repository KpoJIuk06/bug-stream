package az.bugtrack.widget;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import az.bugtrack.common.ApiException;
import az.bugtrack.config.AppProperties;
import az.bugtrack.project.ProjectRepository;
import az.bugtrack.project.ServiceRepository;
import az.bugtrack.report.ReportDtos.ReportMeta;
import az.bugtrack.report.ReportService;
import az.bugtrack.security.AuthUser;
import az.bugtrack.user.UserRecord;
import az.bugtrack.user.UserRepository;
import az.bugtrack.widget.WidgetKeyRepository.WidgetKey;
import jakarta.validation.Valid;

/**
 * Receives reports from the site widget (no sign-in). Access is by the project's widget key
 * in the X-Bug-Stream-Key header (the old name X-Adtask-Key is accepted too); CORS for /api/ingest/** is open
 * (no cookies). Format: docs/api/ingest.openapi.yaml.
 */
@RestController
@RequestMapping("/api/ingest")
public class IngestController {

    static final String SYSTEM_AUTHOR = "widget@adtask.local";

    public record ServiceRef(UUID id, String name) {
    }

    public record WidgetConfig(String projectKey, String projectName, List<ServiceRef> services, List<String> networkIgnore) {
    }

    public record IngestResult(UUID id, String url) {
    }

    private final WidgetService widgets;
    private final ReportService reports;
    private final ProjectRepository projects;
    private final ServiceRepository services;
    private final UserRepository users;
    private final AppProperties props;

    public IngestController(WidgetService widgets, ReportService reports, ProjectRepository projects,
                            ServiceRepository services, UserRepository users, AppProperties props) {
        this.widgets = widgets;
        this.reports = reports;
        this.projects = projects;
        this.services = services;
        this.users = users;
        this.props = props;
    }

    /** The project and its services — for the widget's report form. */
    @GetMapping("/config")
    public WidgetConfig config(@RequestHeader(value = "X-Bug-Stream-Key", required = false) String key,
                               @RequestHeader(value = "X-Adtask-Key", required = false) String legacyKey,
                               @RequestHeader(value = "Origin", required = false) String origin) {
        WidgetKey k = widgets.authorize(key != null ? key : legacyKey, origin, false);
        var p = projects.findSummary(k.projectId(), new UUID(0, 0)).orElseThrow(() -> ApiException.notFound("Project"));
        List<ServiceRef> list = services.listByProject(k.projectId(), false).stream()
                .map(s -> new ServiceRef(s.id(), s.name())).toList();
        return new WidgetConfig(p.key(), p.name(), list, projects.networkIgnore(k.projectId()));
    }

    @PostMapping(value = "/reports", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public IngestResult create(@RequestHeader(value = "X-Bug-Stream-Key", required = false) String key,
                               @RequestHeader(value = "X-Adtask-Key", required = false) String legacyKey,
                               @RequestHeader(value = "Origin", required = false) String origin,
                               @Valid @RequestPart("meta") ReportMeta meta,
                               @RequestPart(value = "events", required = false) String events,
                               @RequestPart(value = "video", required = false) MultipartFile video,
                               @RequestPart(value = "screenshot", required = false) MultipartFile screenshot,
                               @RequestPart(value = "thumbnail", required = false) MultipartFile thumbnail,
                               @RequestPart(value = "replay", required = false) MultipartFile replay) {
        WidgetKey k = widgets.authorize(key != null ? key : legacyKey, origin, true);
        AuthUser author = author(meta.reporterEmail());
        // the author is needed for the history too (TransactionConfig reads it from the SecurityContext)
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(author, null, List.of()));
        UUID id = reports.createFromWidget(author, k.projectId(), meta, events, video, screenshot, thumbnail, replay);
        return new IngestResult(id, props.publicUrl().replaceAll("/+$", "") + "/reports/" + id);
    }

    /** If the e-mail from the site matches an active user, they are the author; otherwise "Site widget". */
    private AuthUser author(String email) {
        if (email != null && !email.isBlank()) {
            var u = users.findByEmail(email.trim()).filter(UserRecord::active);
            if (u.isPresent() && !SYSTEM_AUTHOR.equalsIgnoreCase(u.get().email())) return u.get().toAuthUser(java.util.Set.of());
        }
        return users.findByEmail(SYSTEM_AUTHOR).map(u -> u.toAuthUser(java.util.Set.of()))
                .orElseThrow(() -> new IllegalStateException("System user " + SYSTEM_AUTHOR + " is missing (migration V8)"));
    }
}
