package az.bugtrack.share;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import az.bugtrack.report.ReportDtos.ReportDetails;
import az.bugtrack.security.AuthUser;
import az.bugtrack.share.ShareService.ShareDto;
import az.bugtrack.share.ShareService.ShareRow;
import jakarta.servlet.http.HttpServletRequest;

@RestController
public class ShareController {

    public record ShareRequest(Integer days) {
    }

    private final ShareService service;

    public ShareController(ShareService service) {
        this.service = service;
    }

    /** 204 when the report has no active link. */
    @GetMapping("/api/reports/{id}/share")
    public ResponseEntity<ShareDto> get(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        return service.current(me, id).map(ResponseEntity::ok).orElse(ResponseEntity.noContent().build());
    }

    @PutMapping("/api/reports/{id}/share")
    public ShareDto share(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id,
                          @RequestBody(required = false) ShareRequest req) {
        return service.share(me, id, req == null ? null : req.days());
    }

    @DeleteMapping("/api/reports/{id}/share")
    public ResponseEntity<Void> revoke(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        service.revoke(me, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/admin/shares")
    @PreAuthorize("hasAuthority('settings.manage')")
    public List<ShareRow> active() {
        return service.activeAll();
    }

    @DeleteMapping("/api/admin/shares/{shareId}")
    @PreAuthorize("hasAuthority('settings.manage')")
    public ResponseEntity<Void> revokeById(@AuthenticationPrincipal AuthUser me, @PathVariable UUID shareId) {
        service.revokeById(me, shareId);
        return ResponseEntity.noContent().build();
    }

    // ----------------------------- public (no sign-in) -----------------------------

    @GetMapping("/api/public/reports/{token}")
    public ReportDetails open(@PathVariable String token, HttpServletRequest request,
                              @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String ua) {
        return service.open(token, request.getRemoteAddr(), ua);
    }

    @GetMapping(value = "/api/public/reports/{token}/events", produces = MediaType.APPLICATION_JSON_VALUE)
    public String events(@PathVariable String token) {
        return service.events(token);
    }
}
