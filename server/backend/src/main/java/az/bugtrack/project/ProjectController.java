package az.bugtrack.project;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import az.bugtrack.project.ProjectDtos.CreateProjectRequest;
import az.bugtrack.project.ProjectDtos.CreateServiceRequest;
import az.bugtrack.project.ProjectDtos.HistoryEntry;
import az.bugtrack.project.ProjectDtos.MemberDto;
import az.bugtrack.project.ProjectDtos.ProjectDetails;
import az.bugtrack.project.ProjectDtos.ProjectSettingsRequest;
import az.bugtrack.project.ProjectDtos.ProjectSummary;
import az.bugtrack.project.ProjectDtos.ResolveResult;
import az.bugtrack.project.ProjectDtos.ServiceDto;
import az.bugtrack.project.ProjectDtos.SetMemberRequest;
import az.bugtrack.project.ProjectDtos.UpdateProjectRequest;
import az.bugtrack.security.AuthUser;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService projects;
    private final ServiceCatalogService services;

    public ProjectController(ProjectService projects, ServiceCatalogService services) {
        this.projects = projects;
        this.services = services;
    }

    @GetMapping
    public List<ProjectSummary> list(@AuthenticationPrincipal AuthUser me,
                                     @RequestParam(defaultValue = "") String q,
                                     @RequestParam(defaultValue = "false") boolean includeArchived) {
        return projects.list(me, q, includeArchived);
    }

    /** For the extension: which project/service matches the page URL. matched=false: none. */
    @GetMapping("/resolve")
    public ResolveResult resolve(@AuthenticationPrincipal AuthUser me, @RequestParam String url) {
        return services.resolve(me, url);
    }

    @GetMapping("/by-key/{key}")
    public ProjectDetails getByKey(@AuthenticationPrincipal AuthUser me, @PathVariable String key) {
        return projects.getByKey(me, key);
    }

    @GetMapping("/{id}")
    public ProjectDetails get(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return projects.get(me, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectDetails create(@AuthenticationPrincipal AuthUser me, @Valid @RequestBody CreateProjectRequest req) {
        return projects.create(me, req.key(), req.name(), req.description(), req.visibility());
    }

    @PatchMapping("/{id}")
    public ProjectDetails update(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id,
                                 @Valid @RequestBody UpdateProjectRequest req) {
        return projects.update(me, id, req.name(), req.description(), req.visibility());
    }

    @PutMapping("/{id}/settings")
    public ProjectDetails updateSettings(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id,
                                         @Valid @RequestBody ProjectSettingsRequest req) {
        return projects.updateSettings(me, id, req.networkIgnore());
    }

    @PostMapping("/{id}/archive")
    public ProjectDetails archive(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return projects.setArchived(me, id, true);
    }

    @PostMapping("/{id}/restore")
    public ProjectDetails restore(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return projects.setArchived(me, id, false);
    }

    // ----------------------------- services -----------------------------

    @PostMapping("/{id}/services")
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceDto createService(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id,
                                    @Valid @RequestBody CreateServiceRequest req) {
        return services.create(me, id, req.code(), req.name(), req.description(), req.environment(), req.patterns());
    }

    // ----------------------------- members -----------------------------

    @GetMapping("/{id}/members")
    public List<MemberDto> members(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return projects.members(me, id);
    }

    /** Adds a member or changes their role. */
    @PutMapping("/{id}/members/{userId}")
    public List<MemberDto> setMember(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id,
                                     @PathVariable UUID userId, @Valid @RequestBody SetMemberRequest req) {
        return projects.setMember(me, id, userId, req.role());
    }

    @DeleteMapping("/{id}/members/{userId}")
    public List<MemberDto> removeMember(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id,
                                        @PathVariable UUID userId) {
        return projects.removeMember(me, id, userId);
    }

    // ----------------------------- history -----------------------------

    @GetMapping("/{id}/history")
    public List<HistoryEntry> history(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id,
                                      @RequestParam(defaultValue = "100") int limit) {
        return projects.history(me, id, limit);
    }
}
