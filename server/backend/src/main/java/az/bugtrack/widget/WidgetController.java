package az.bugtrack.widget;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import az.bugtrack.security.AuthUser;
import az.bugtrack.widget.WidgetKeyRepository.WidgetKey;
import az.bugtrack.widget.WidgetService.CreatedKey;
import az.bugtrack.widget.WidgetService.KeyRequest;

/** Project widget keys — project owners and maintainers only. */
@RestController
public class WidgetController {

    private final WidgetService service;

    public WidgetController(WidgetService service) {
        this.service = service;
    }

    @GetMapping("/api/projects/{projectId}/widget-keys")
    public List<WidgetKey> list(@AuthenticationPrincipal AuthUser me, @PathVariable UUID projectId) {
        return service.list(me, projectId);
    }

    /** The response contains the whole key — it is shown only once. */
    @PostMapping("/api/projects/{projectId}/widget-keys")
    @ResponseStatus(HttpStatus.CREATED)
    public CreatedKey create(@AuthenticationPrincipal AuthUser me, @PathVariable UUID projectId, @RequestBody KeyRequest req) {
        return service.create(me, projectId, req);
    }

    @PatchMapping("/api/widget-keys/{id}")
    public WidgetKey update(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id, @RequestBody KeyRequest req) {
        return service.update(me, id, req);
    }

    @DeleteMapping("/api/widget-keys/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        service.delete(me, id);
        return ResponseEntity.noContent().build();
    }
}
