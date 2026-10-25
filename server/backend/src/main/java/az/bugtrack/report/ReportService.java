package az.bugtrack.report;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import az.bugtrack.access.Permissions;
import az.bugtrack.common.ApiException;
import az.bugtrack.environment.EnvironmentRepository;
import az.bugtrack.eav.AttributeDef;
import az.bugtrack.eav.AttributeRegistry;
import az.bugtrack.eav.EavRepository;
import az.bugtrack.eav.EavRepository.EntityRow;
import az.bugtrack.eav.ValueConverter;
import az.bugtrack.notification.NotificationService;
import az.bugtrack.project.ProjectAccess;
import az.bugtrack.project.ProjectDtos.ResolveResult;
import az.bugtrack.project.ServiceCatalogService;
import az.bugtrack.project.ServiceRepository;
import az.bugtrack.report.ReportDtos.HistoryEntry;
import az.bugtrack.report.ReportDtos.JiraRef;
import az.bugtrack.report.ReportDtos.Page;
import az.bugtrack.report.ReportDtos.ProjectGroup;
import az.bugtrack.report.ReportDtos.ProjectRef;
import az.bugtrack.report.ReportDtos.Ref;
import az.bugtrack.report.ReportDtos.ReportDetails;
import az.bugtrack.report.ReportDtos.ReportFilter;
import az.bugtrack.report.ReportDtos.ReportListItem;
import az.bugtrack.report.ReportDtos.ReportMeta;
import az.bugtrack.report.ReportDtos.UpdateReportRequest;
import az.bugtrack.security.AuthUser;
import az.bugtrack.storage.FileRepository;
import az.bugtrack.storage.FileRepository.FileRow;
import az.bugtrack.storage.FileRepository.Kind;
import az.bugtrack.storage.FileStorage;
import az.bugtrack.storage.FileUrlSigner;
import az.bugtrack.user.UserRepository;

/**
 * Bug reports. Access:
 *   read                   — everyone who can read the project;
 *   create                 — report.create;
 *   change fields / move   — the author, or report.edit;
 *   delete / restore       — the author, report.delete_all, project OWNER/MAINTAINER.
 */
@Service
public class ReportService {

    static final String TYPE = "report";
    private static final DateTimeFormatter MONTH_DIR = DateTimeFormatter.ofPattern("yyyy/MM");

    private final EavRepository eav;
    private final AttributeRegistry attributes;
    private final ReportRepository reports;
    private final FileRepository files;
    private final FileStorage storage;
    private final FileUrlSigner signer;
    private final ServiceCatalogService catalog;
    private final ServiceRepository serviceRepo;
    private final ProjectAccess access;
    private final UserRepository users;
    private final NotificationService notifications;
    private final EnvironmentRepository environments;
    private final az.bugtrack.slack.SlackService slack;

    public ReportService(EavRepository eav, AttributeRegistry attributes, ReportRepository reports,
                         FileRepository files, FileStorage storage, FileUrlSigner signer,
                         ServiceCatalogService catalog, ServiceRepository serviceRepo, ProjectAccess access,
                         UserRepository users, NotificationService notifications,
                         EnvironmentRepository environments, az.bugtrack.slack.SlackService slack) {
        this.environments = environments;
        this.slack = slack;
        this.eav = eav;
        this.attributes = attributes;
        this.reports = reports;
        this.files = files;
        this.storage = storage;
        this.signer = signer;
        this.catalog = catalog;
        this.serviceRepo = serviceRepo;
        this.access = access;
        this.users = users;
        this.notifications = notifications;
    }

    // ----------------------------- create -----------------------------

    @Transactional
    public ReportDetails create(AuthUser me, ReportMeta meta, String eventsJson,
                                MultipartFile video, MultipartFile screenshot, MultipartFile thumbnail,
                                MultipartFile replay) {
        if (!me.has(Permissions.REPORT_CREATE)) {
            throw ApiException.forbidden("Your role cannot create reports");
        }
        // 1. Project and service: explicit in meta, or resolved from the page URL
        UUID projectId = meta.projectId();
        UUID serviceId = meta.serviceId();
        if (projectId == null) {
            ResolveResult r = catalog.resolve(me, meta.pageUrl());
            if (r.matched()) {
                projectId = r.projectId();
                serviceId = r.serviceId();
            }
        } else {
            access.requireReadable(me, projectId);
            checkServiceBelongs(projectId, serviceId);
        }

        UUID id = createInternal(me, projectId, serviceId, meta, eventsJson, video, screenshot, thumbnail, replay);
        return details(me, id);
    }

    /**
     * A report from the site widget: the project comes from the widget key, the author's access is not checked
     * (the key is the permission). Service: from meta if it belongs to the project, otherwise by page URL.
     */
    @Transactional
    public UUID createFromWidget(AuthUser author, UUID projectId, ReportMeta meta, String eventsJson,
                                 MultipartFile video, MultipartFile screenshot, MultipartFile thumbnail,
                                 MultipartFile replay) {
        UUID serviceId = meta.serviceId();
        if (serviceId != null && serviceRepo.find(serviceId).filter(s -> s.projectId().equals(projectId)).isEmpty()) {
            serviceId = null;
        }
        if (serviceId == null) {
            serviceId = catalog.resolveInProject(projectId, meta.pageUrl());
        }
        return createInternal(author, projectId, serviceId, meta, eventsJson, video, screenshot, thumbnail, replay);
    }

    private UUID createInternal(AuthUser me, UUID projectId, UUID serviceId, ReportMeta meta, String eventsJson,
                                         MultipartFile video, MultipartFile screenshot, MultipartFile thumbnail,
                                         MultipartFile replay) {
        // 2. Entity and fields
        UUID id = eav.createEntity(attributes.entityTypeId(TYPE), null, projectId, serviceId, me.id());
        Map<String, AttributeDef> defs = attributes.byCode(TYPE, projectId);
        Map<String, Object> fields = metaToFields(meta);
        fields.put("environment", environment(meta.environment(), serviceId));
        writeFields(id, defs, fields, true);

        // 3. Events and files
        reports.insertEvents(id, eventsJson);
        String dir = "reports/" + OffsetDateTime.now().format(MONTH_DIR) + "/" + id;
        cleanupOnRollback(dir);
        UUID videoId = saveFile(id, dir, Kind.VIDEO, video, meta.durationMs(), me.id());
        saveFile(id, dir, Kind.SCREENSHOT, screenshot, null, me.id());
        UUID thumbId = saveFile(id, dir, Kind.THUMBNAIL, thumbnail, null, me.id());
        saveFile(id, dir, Kind.REPLAY, replay, meta.durationMs(), me.id());
        reports.upsertSummary(id, meta.durationMs(), videoId, thumbId);
        notifications.reportCreated(id, me);
        slack.reportCreated(id, projectId, meta.title(), me.fullName(), (String) fields.get("environment"));

        return id;
    }

    /** Environment of a new report: chosen by the person, otherwise the service's one, otherwise empty. */
    private String environment(String chosen, UUID serviceId) {
        if (chosen != null && !chosen.isBlank()) {
            String code = chosen.trim().toUpperCase(Locale.ROOT);
            if (environments.isActive(code)) {
                return code;
            }
        }
        if (serviceId == null) return null;
        return serviceRepo.find(serviceId).map(s -> s.environment()).orElse(null);
    }

    private static Map<String, Object> metaToFields(ReportMeta m) {
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("title", m.title());
        f.put("description", m.description());
        f.put("status", "NEW");
        f.put("severity", m.severity());
        f.put("tags", m.tags());
        f.put("source", m.source() == null ? "EXTENSION" : m.source().toUpperCase(Locale.ROOT));
        f.put("page_url", m.pageUrl());
        f.put("page_title", m.pageTitle());
        f.put("recorded_at", m.recordedAt() == null ? OffsetDateTime.now().toString() : m.recordedAt().toString());
        f.put("timezone", m.timezone());
        f.put("locale", m.locale());
        f.put("location", m.location());
        f.put("os", m.os());
        f.put("os_version", m.osVersion());
        f.put("browser", m.browser());
        f.put("browser_version", m.browserVersion());
        f.put("window_size", m.windowSize());
        f.put("screen_size", m.screenSize());
        f.put("device_pixel_ratio", m.devicePixelRatio());
        f.put("network_type", m.networkType());
        f.put("network_downlink", m.networkDownlink());
        f.put("network_rtt", m.networkRtt());
        f.put("extension_version", m.extensionVersion());
        return f;
    }

    private UUID saveFile(UUID entityId, String dir, Kind kind, MultipartFile file, Integer durationMs, UUID by) {
        if (file == null || file.isEmpty()) {
            return null;
        }
        String mime = file.getContentType() == null ? "application/octet-stream" : file.getContentType();
        String name = kind.name().toLowerCase(Locale.ROOT) + extension(file.getOriginalFilename(), mime);
        try (InputStream in = file.getInputStream()) {
            FileStorage.Saved saved = storage.save(dir + "/" + name, in);
            return files.insert(entityId, kind, saved, name, mime, durationMs, by);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot store " + kind + " file", e);
        }
    }

    /** If the transaction rolls back, delete the files already written. */
    private void cleanupOnRollback(String dir) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    storage.deleteDirQuietly(dir);
                }
            }
        });
    }

    private static String extension(String originalName, String mime) {
        if (originalName != null && originalName.matches(".*\\.[A-Za-z0-9]{1,5}$")) {
            return originalName.substring(originalName.lastIndexOf('.')).toLowerCase(Locale.ROOT);
        }
        return switch (mime) {
            case "video/webm" -> ".webm";
            case "video/mp4" -> ".mp4";
            case "image/png" -> ".png";
            case "image/jpeg" -> ".jpg";
            case "image/webp" -> ".webp";
            case "application/json" -> ".json";
            case "application/gzip" -> ".json.gz";
            default -> "";
        };
    }

    // ----------------------------- read -----------------------------

    @Transactional(readOnly = true)
    public Page<ReportListItem> list(ReportFilter filter) {
        List<ReportRepository.CardRow> rows = reports.list(filter);
        long total = reports.count(filter);
        Map<UUID, List<String>> tags = eav.stringValues(rows.stream().map(ReportRepository.CardRow::id).toList(), "tags");
        List<ReportListItem> items = rows.stream().map(r -> new ReportListItem(
                r.id(),
                r.projectId() == null ? null : new ProjectRef(r.projectId(), r.projectKey(), r.projectName()),
                r.serviceId() == null ? null : new Ref(r.serviceId(), r.serviceName()),
                new Ref(r.authorId(), r.authorName()),
                r.assigneeId() == null ? null : new Ref(r.assigneeId(), r.assigneeName()),
                r.createdAt(), r.updatedAt(), r.title(), r.status(), r.severity(), r.environment(), r.pageUrl(), r.browser(), r.os(),
                r.durationMs(), r.consoleErrors(), r.networkErrors(), r.commentsCount(),
                r.thumbnailFileId() == null ? null : signer.url(r.thumbnailFileId()),
                tags.getOrDefault(r.id(), List.of()),
                r.jiraKey() == null ? null : new JiraRef(r.jiraKey(), r.jiraUrl(), r.jiraStatus(), r.jiraCategory())))
                .toList();
        return new Page<>(items, filter.page(), filter.size(), total);
    }

    @Transactional(readOnly = true)
    public List<ProjectGroup> groups(ReportFilter filter) {
        return reports.groups(filter).stream().map(g -> new ProjectGroup(
                        g.projectId() == null ? null : new ProjectRef(g.projectId(), g.projectKey(), g.projectName()),
                        g.jiraProjectKey(), g.total(), g.newCount(), g.inProgress(), g.done(), g.withErrors(), g.critical(),
                        g.inJira(), g.jiraDone(), g.lastAt(),
                        g.thumbnails().stream().map(signer::url).toList()))
                .toList();
    }

    @Transactional(readOnly = true)
    public ReportDetails details(AuthUser me, UUID id) {
        ReportRepository.Header h = reports.header(id).orElseThrow(() -> ApiException.notFound("Report"));
        if (h.project() != null) {
            access.requireReadable(me, h.project().id());
        }
        List<FileRow> fileRows = files.listByEntities(List.of(id));
        return new ReportDetails(
                h.id(), h.project(), h.service(), h.author(), h.createdAt(), h.updatedAt(), h.deletedAt(),
                eav.valuesJson(id),
                reports.summary(id),
                fileRows.stream().map(signer::toDto).toList(),
                canDelete(me, h),
                canEdit(me, h.author().id()));
    }

    @Transactional(readOnly = true)
    public String events(AuthUser me, UUID id, String kind) {
        requireReport(me, id);
        return reports.eventsJson(id, kind);
    }

    @Transactional(readOnly = true)
    public List<HistoryEntry> history(AuthUser me, UUID id) {
        requireReport(me, id);
        return reports.history(id);
    }

    // ----------------------------- change -----------------------------

    @Transactional
    public ReportDetails update(AuthUser me, UUID id, UpdateReportRequest req) {
        EntityRow e = requireReport(me, id);
        if (!canEdit(me, e.createdBy())) {
            throw ApiException.forbidden("Your role cannot change other people's reports");
        }
        if (e.deletedAt() != null) {
            throw ApiException.badRequest("REPORT_DELETED", "Restore the report before editing");
        }
        UUID projectId = e.projectId();

        // Move to another project / service
        boolean moving = req.projectId() != null || req.serviceId() != null || Boolean.TRUE.equals(req.clearProject());
        if (moving) {
            UUID newProject = Boolean.TRUE.equals(req.clearProject()) ? null
                    : (req.projectId() != null ? req.projectId() : projectId);
            UUID newService = newProject == null ? null : req.serviceId();
            if (newProject != null) {
                access.requireReadable(me, newProject);
                checkServiceBelongs(newProject, newService);
            }
            eav.move(id, newProject, newService);
            projectId = newProject;
        }

        if (req.fields() != null && !req.fields().isEmpty()) {
            Map<String, AttributeDef> defs = attributes.byCode(TYPE, projectId);
            Object oldStatus = eav.readSingle(id, defs.get("status"));
            Object oldAssignee = eav.readSingle(id, defs.get("assignee_id"));
            writeFields(id, defs, req.fields(), false);
            Object newStatus = eav.readSingle(id, defs.get("status"));
            Object newAssignee = eav.readSingle(id, defs.get("assignee_id"));
            if (newStatus != null && !newStatus.equals(oldStatus)) {
                notifications.statusChanged(id, (String) oldStatus, (String) newStatus, me);
            }
            if (newAssignee != null && !newAssignee.equals(oldAssignee)) {
                notifications.assigned(id, (UUID) newAssignee, me);
            }
            eav.touch(id);
        }
        return details(me, id);
    }

    @Transactional
    public ReportDetails setDeleted(AuthUser me, UUID id, boolean deleted) {
        requireReport(me, id);
        ReportRepository.Header h = reports.header(id).orElseThrow(() -> ApiException.notFound("Report"));
        if (!canDelete(me, h)) {
            throw ApiException.forbidden("Only the author, project owners/maintainers or admins can delete a report");
        }
        eav.setDeleted(id, deleted);
        return details(me, id);
    }

    // ------------------------------------------------------------------

    /**
     * Writes fields. creating=true (new report): unknown fields are silently skipped
     * (the extension may send more than we store), required ones are checked.
     */
    private void writeFields(UUID entityId, Map<String, AttributeDef> defs, Map<String, Object> fields, boolean creating) {
        List<String> unknown = new ArrayList<>();
        for (Map.Entry<String, Object> entry : fields.entrySet()) {
            AttributeDef a = defs.get(entry.getKey());
            if (a == null) {
                unknown.add(entry.getKey());
                continue;
            }
            if (a.multi()) {
                eav.setMulti(entityId, a, ValueConverter.convertList(a, entry.getValue()));
            } else {
                Object value = ValueConverter.convert(a, entry.getValue());
                if (value == null && a.required()) {
                    throw ApiException.badRequest("FIELD_REQUIRED", "Field '" + a.code() + "' is required");
                }
                if (value != null && "assignee_id".equals(a.code()) && users.findById((UUID) value).isEmpty()) {
                    throw ApiException.badRequest("INVALID_FIELD", "Assignee not found");
                }
                if (value != null && "environment".equals(a.code()) && !creating
                        && !environments.isActive(value.toString())) {
                    throw ApiException.badRequest("INVALID_ENVIRONMENT", "Unknown or inactive environment: " + value);
                }
                eav.setSingle(entityId, a, value);
            }
        }
        if (!creating && !unknown.isEmpty()) {
            throw ApiException.badRequest("UNKNOWN_FIELD", "Unknown fields: " + unknown);
        }
        if (creating) {
            for (AttributeDef a : defs.values()) {
                if (a.required() && !a.multi() && eav.readSingle(entityId, a) == null) {
                    throw ApiException.badRequest("FIELD_REQUIRED", "Field '" + a.code() + "' is required");
                }
            }
        }
    }

    private EntityRow requireReport(AuthUser me, UUID id) {
        EntityRow e = eav.find(id).filter(r -> TYPE.equals(r.type()))
                .orElseThrow(() -> ApiException.notFound("Report"));
        if (e.projectId() != null) {
            access.requireReadable(me, e.projectId());
        }
        return e;
    }

    private boolean canEdit(AuthUser me, UUID authorId) {
        return me.has(Permissions.REPORT_EDIT) || me.id().equals(authorId);
    }

    private boolean canDelete(AuthUser me, ReportRepository.Header h) {
        return me.has(Permissions.REPORT_DELETE_ALL) || me.id().equals(h.author().id())
                || (h.project() != null && access.canManage(me, h.project().id()));
    }

    private void checkServiceBelongs(UUID projectId, UUID serviceId) {
        if (serviceId == null) {
            return;
        }
        var s = serviceRepo.find(serviceId).orElseThrow(() -> ApiException.notFound("Service"));
        if (!s.projectId().equals(projectId)) {
            throw ApiException.badRequest("SERVICE_NOT_IN_PROJECT", "Service does not belong to the project");
        }
    }
}
