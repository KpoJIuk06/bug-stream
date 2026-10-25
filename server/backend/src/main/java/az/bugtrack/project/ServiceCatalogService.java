package az.bugtrack.project;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import az.bugtrack.access.Permissions;
import az.bugtrack.common.ApiException;
import az.bugtrack.environment.EnvironmentRepository;
import az.bugtrack.project.ProjectDtos.CreatePatternRequest;
import az.bugtrack.project.ProjectDtos.ResolveResult;
import az.bugtrack.project.ProjectDtos.ServiceDto;
import az.bugtrack.project.ProjectDtos.UrlPatternDto;
import az.bugtrack.project.ServiceRepository.ServiceRow;
import az.bugtrack.security.AuthUser;

/** Project services, their URL patterns and resolving a project from a page URL. */
@Service
public class ServiceCatalogService {

    private final ServiceRepository services;
    private final ProjectAccess access;
    private final EnvironmentRepository environments;

    public ServiceCatalogService(ServiceRepository services, ProjectAccess access, EnvironmentRepository environments) {
        this.services = services;
        this.access = access;
        this.environments = environments;
    }

    /** Services of a project with their patterns (the caller checks access). */
    @Transactional(readOnly = true)
    public List<ServiceDto> listWithPatterns(UUID projectId, boolean includeArchived) {
        Map<UUID, List<UrlPatternDto>> patterns = services.patternsByProject(projectId).stream()
                .collect(Collectors.groupingBy(UrlPatternDto::serviceId));
        return services.listByProject(projectId, includeArchived).stream()
                .map(s -> toDto(s, patterns.getOrDefault(s.id(), List.of())))
                .toList();
    }

    @Transactional(readOnly = true)
    public ServiceDto get(AuthUser me, UUID serviceId) {
        ServiceRow s = services.find(serviceId).orElseThrow(() -> ApiException.notFound("Service"));
        access.requireReadable(me, s.projectId());
        return reload(s.projectId(), serviceId);
    }

    @Transactional
    public ServiceDto create(AuthUser me, UUID projectId, String code, String name, String description,
                             String env, List<CreatePatternRequest> patterns) {
        access.requireReadable(me, projectId);
        access.requireManage(me, projectId);
        if (services.codeExists(projectId, code)) {
            throw ApiException.conflict("SERVICE_CODE_TAKEN", "Service with code " + code + " already exists in project");
        }
        String environment = env == null || env.isBlank()
                ? environments.defaultCode().orElseThrow(() -> ApiException.badRequest("NO_ENVIRONMENTS", "No active environments"))
                : requireEnvironment(env, null);
        UUID id = services.insert(projectId, code, name, description, environment, me.id());
        if (patterns != null) {
            for (CreatePatternRequest p : patterns) {
                addPatternInternal(id, p);
            }
        }
        return reload(projectId, id);
    }

    @Transactional
    public ServiceDto update(AuthUser me, UUID serviceId, String name, String description, String env) {
        ServiceRow s = requireManageable(me, serviceId);
        services.update(serviceId, name, description, requireEnvironment(env, s.environment()));
        return reload(s.projectId(), serviceId);
    }

    @Transactional
    public ServiceDto setArchived(AuthUser me, UUID serviceId, boolean archived) {
        ServiceRow s = requireManageable(me, serviceId);
        services.setArchived(serviceId, archived);
        return reload(s.projectId(), serviceId);
    }

    @Transactional
    public ServiceDto addPattern(AuthUser me, UUID serviceId, CreatePatternRequest req) {
        ServiceRow s = requireManageable(me, serviceId);
        addPatternInternal(serviceId, req);
        return reload(s.projectId(), serviceId);
    }

    @Transactional
    public ServiceDto deletePattern(AuthUser me, UUID patternId) {
        var owner = services.findPatternOwner(patternId).orElseThrow(() -> ApiException.notFound("URL pattern"));
        access.requireReadable(me, owner.projectId());
        access.requireManage(me, owner.projectId());
        services.deletePattern(patternId);
        return reload(owner.projectId(), owner.serviceId());
    }

    /** Service of a project by page URL (for the widget: the project is known from its key). null if none. */
    @Transactional(readOnly = true)
    public UUID resolveInProject(UUID projectId, String url) {
        var candidates = services.activeCandidates(new UUID(0, 0), true).stream()
                .filter(c -> projectId.equals(c.payload().projectId()))
                .toList();
        return UrlMatcher.match(url, candidates).map(c -> c.payload().serviceId()).orElse(null);
    }

    /**
     * Resolves project and service from a page URL. Called by the extension before recording.
     * Only active projects and services count; PRIVATE projects only for members and project.view_all.
     */
    @Transactional(readOnly = true)
    public ResolveResult resolve(AuthUser me, String url) {
        return UrlMatcher.match(url, services.activeCandidates(me.id(), me.has(Permissions.PROJECT_VIEW_ALL)))
                .map(UrlMatcher.Candidate::payload)
                .orElse(ResolveResult.none());
    }

    // ------------------------------------------------------------------

    /** Environment must exist and be active; the current value of a service may stay even if hidden. */
    private String requireEnvironment(String env, String current) {
        String code = env.trim().toUpperCase(java.util.Locale.ROOT);
        if (code.equals(current) ? !environments.exists(code) : !environments.isActive(code)) {
            throw ApiException.badRequest("INVALID_ENVIRONMENT", "Unknown or inactive environment: " + code);
        }
        return code;
    }

    private void addPatternInternal(UUID serviceId, CreatePatternRequest req) {
        String pattern = req.pattern().trim();
        String error = UrlMatcher.validate(req.matchType(), pattern);
        if (error != null) {
            throw ApiException.badRequest("INVALID_PATTERN", error);
        }
        if (services.patternExists(serviceId, req.matchType(), pattern)) {
            throw ApiException.conflict("PATTERN_EXISTS", "This pattern already exists for the service");
        }
        services.insertPattern(serviceId, req.matchType(), pattern, req.priority() == null ? 0 : req.priority());
    }

    private ServiceRow requireManageable(AuthUser me, UUID serviceId) {
        ServiceRow s = services.find(serviceId).orElseThrow(() -> ApiException.notFound("Service"));
        access.requireReadable(me, s.projectId());
        access.requireManage(me, s.projectId());
        return s;
    }

    private ServiceDto reload(UUID projectId, UUID serviceId) {
        return listWithPatterns(projectId, true).stream()
                .filter(s -> s.id().equals(serviceId))
                .findFirst()
                .orElseThrow(() -> ApiException.notFound("Service"));
    }

    private static ServiceDto toDto(ServiceRow s, List<UrlPatternDto> patterns) {
        return new ServiceDto(s.id(), s.projectId(), s.code(), s.name(), s.description(), s.environment(),
                s.createdAt(), s.archivedAt(), patterns);
    }
}
