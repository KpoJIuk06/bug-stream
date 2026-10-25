package az.bugtrack.slack;

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
import org.springframework.web.bind.annotation.RestController;

import az.bugtrack.project.ProjectAccess;
import az.bugtrack.security.AuthUser;
import az.bugtrack.slack.SlackService.ConnectionRequest;
import az.bugtrack.slack.SlackService.Status;

@RestController
public class SlackController {

    public record ChannelRequest(String channel) {
    }

    private final SlackService service;
    private final ProjectAccess access;

    public SlackController(SlackService service, ProjectAccess access) {
        this.service = service;
        this.access = access;
    }

    @GetMapping("/api/admin/slack")
    @PreAuthorize("hasAuthority('integration.manage')")
    public Status status() {
        return service.status();
    }

    @PutMapping("/api/admin/slack")
    @PreAuthorize("hasAuthority('integration.manage')")
    public Status save(@AuthenticationPrincipal AuthUser me, @RequestBody ConnectionRequest req) {
        return service.save(me, req);
    }

    @DeleteMapping("/api/admin/slack")
    @PreAuthorize("hasAuthority('integration.manage')")
    public ResponseEntity<Void> delete() {
        service.delete();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/admin/slack/test")
    @PreAuthorize("hasAuthority('integration.manage')")
    public ResponseEntity<Void> test(@RequestBody(required = false) ChannelRequest req) {
        service.test(req == null ? null : req.channel());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/projects/{id}/slack")
    public ChannelRequest channel(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        access.requireReadable(me, id);
        return new ChannelRequest(service.projectChannel(id));
    }

    @PutMapping("/api/projects/{id}/slack")
    public ChannelRequest setChannel(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id,
                                     @RequestBody ChannelRequest req) {
        access.requireReadable(me, id);
        access.requireManage(me, id);
        service.setProjectChannel(id, req.channel());
        return new ChannelRequest(service.projectChannel(id));
    }
}
