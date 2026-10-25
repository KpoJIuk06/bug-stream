package az.bugtrack.notification;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import az.bugtrack.notification.NotificationRepository.NotificationDto;
import az.bugtrack.security.AuthUser;

@RestController
public class NotificationController {

    public record Preferences(boolean emailNotifications, boolean emailConfigured, boolean slackNotifications,
                              boolean slackConfigured) {
    }

    public record PreferencesUpdate(Boolean emailNotifications, Boolean slackNotifications) {
    }

    private final NotificationService service;
    private final MailNotifier mail;
    private final az.bugtrack.slack.SlackService slack;

    public NotificationController(NotificationService service, MailNotifier mail, az.bugtrack.slack.SlackService slack) {
        this.service = service;
        this.mail = mail;
        this.slack = slack;
    }

    @GetMapping("/api/notifications")
    public List<NotificationDto> list(@AuthenticationPrincipal AuthUser me,
                                      @RequestParam(defaultValue = "false") boolean unreadOnly,
                                      @RequestParam(defaultValue = "50") int limit) {
        return service.list(me.id(), unreadOnly, limit);
    }

    @GetMapping("/api/notifications/unread-count")
    public Map<String, Long> unreadCount(@AuthenticationPrincipal AuthUser me) {
        return Map.of("count", service.unreadCount(me.id()));
    }

    @PostMapping("/api/notifications/{id}/read")
    public ResponseEntity<Void> read(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        service.markRead(id, me.id());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/notifications/read-all")
    public ResponseEntity<Void> readAll(@AuthenticationPrincipal AuthUser me) {
        service.markAllRead(me.id());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/auth/me/preferences")
    public Preferences preferences(@AuthenticationPrincipal AuthUser me) {
        return new Preferences(service.emailEnabled(me.id()), mail.isConfigured(), service.slackEnabled(me.id()),
                slack.configured());
    }

    @PutMapping("/api/auth/me/preferences")
    public Preferences updatePreferences(@AuthenticationPrincipal AuthUser me, @RequestBody PreferencesUpdate req) {
        if (req.slackNotifications() != null) {
            service.setSlackEnabled(me.id(), req.slackNotifications());
        }
        if (req.emailNotifications() != null) {
            service.setEmailEnabled(me.id(), req.emailNotifications());
        }
        return preferences(me);
    }
}
