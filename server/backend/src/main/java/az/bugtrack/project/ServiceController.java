package az.bugtrack.project;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import az.bugtrack.project.ProjectDtos.CreatePatternRequest;
import az.bugtrack.project.ProjectDtos.ServiceDto;
import az.bugtrack.project.ProjectDtos.UpdateServiceRequest;
import az.bugtrack.security.AuthUser;
import jakarta.validation.Valid;

/** Operations on a single service and its URL patterns. Creating a service: POST /api/projects/{id}/services. */
@RestController
public class ServiceController {

    private final ServiceCatalogService services;

    public ServiceController(ServiceCatalogService services) {
        this.services = services;
    }

    @GetMapping("/api/services/{id}")
    public ServiceDto get(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return services.get(me, id);
    }

    @PatchMapping("/api/services/{id}")
    public ServiceDto update(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id,
                             @Valid @RequestBody UpdateServiceRequest req) {
        return services.update(me, id, req.name(), req.description(), req.environment());
    }

    @PostMapping("/api/services/{id}/archive")
    public ServiceDto archive(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return services.setArchived(me, id, true);
    }

    @PostMapping("/api/services/{id}/restore")
    public ServiceDto restore(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return services.setArchived(me, id, false);
    }

    @PostMapping("/api/services/{id}/patterns")
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceDto addPattern(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id,
                                 @Valid @RequestBody CreatePatternRequest req) {
        return services.addPattern(me, id, req);
    }

    @DeleteMapping("/api/url-patterns/{patternId}")
    public ServiceDto deletePattern(@AuthenticationPrincipal AuthUser me, @PathVariable UUID patternId) {
        return services.deletePattern(me, patternId);
    }
}
