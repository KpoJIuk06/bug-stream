package az.bugtrack.notification;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import az.bugtrack.notification.NotificationRepository.NotificationDto;
import az.bugtrack.notification.NotificationRepository.ReportPeople;
import az.bugtrack.notification.NotificationRepository.Type;
import az.bugtrack.security.AuthUser;

/**
 * Notifications on the site (+ e-mails, sent by MailNotifier on a schedule).
 * Nobody is notified about their own actions.
 */
@Service
public class NotificationService {

    private static final Map<String, String> STATUS = Map.of(
            "NEW", "New", "IN_PROGRESS", "In progress", "RESOLVED", "Resolved", "CLOSED", "Closed", "REJECTED", "Rejected");

    private final NotificationRepository repo;

    public NotificationService(NotificationRepository repo) {
        this.repo = repo;
    }

    // ----------------------------- events -----------------------------

    /** New report in a project — to the project's owners and maintainers. */
    @Transactional
    public void reportCreated(UUID reportId, AuthUser actor) {
        ReportPeople r = repo.reportPeople(reportId).orElse(null);
        if (r == null || r.projectId() == null) return;
        send(repo.projectManagers(r.projectId()), actor, Type.REPORT_CREATED, reportId, null,
                actor.fullName() + " created the report \"" + r.title() + "\"", null);
    }

    @Transactional
    public void assigned(UUID reportId, UUID assigneeId, AuthUser actor) {
        ReportPeople r = repo.reportPeople(reportId).orElse(null);
        if (r == null || assigneeId == null) return;
        send(List.of(assigneeId), actor, Type.ASSIGNED, reportId, null,
                actor.fullName() + " assigned you to \"" + r.title() + "\"", null);
    }

    @Transactional
    public void statusChanged(UUID reportId, String oldStatus, String newStatus, AuthUser actor) {
        ReportPeople r = repo.reportPeople(reportId).orElse(null);
        if (r == null) return;
        send(people(r.authorId(), r.assigneeId()), actor, Type.STATUS_CHANGED, reportId, null,
                actor.fullName() + " changed the status of \"" + r.title() + "\"",
                label(oldStatus) + " → " + label(newStatus));
    }

    /**
     * New comment: mentioned people get MENTION; the report author, the assignee and the author of the comment
     * being replied to get COMMENT (unless already mentioned).
     */
    @Transactional
    public void commented(UUID reportId, UUID commentId, String body, Collection<UUID> mentions, UUID replyToAuthor,
                          AuthUser actor) {
        ReportPeople r = repo.reportPeople(reportId).orElse(null);
        if (r == null) return;
        String excerpt = body.length() > 300 ? body.substring(0, 300) + "…" : body;
        Set<UUID> mentioned = new LinkedHashSet<>(mentions);
        send(mentioned, actor, Type.MENTION, reportId, commentId,
                actor.fullName() + " mentioned you in \"" + r.title() + "\"", excerpt);

        Set<UUID> others = people(r.authorId(), r.assigneeId(), replyToAuthor);
        others.removeAll(mentioned);
        send(others, actor, Type.COMMENT, reportId, commentId,
                actor.fullName() + " commented on \"" + r.title() + "\"", excerpt);
    }

    // ----------------------------- read -----------------------------

    @Transactional(readOnly = true)
    public List<NotificationDto> list(UUID userId, boolean unreadOnly, int limit) {
        return repo.list(userId, unreadOnly, Math.clamp(limit, 1, 200));
    }

    @Transactional(readOnly = true)
    public long unreadCount(UUID userId) {
        return repo.unreadCount(userId);
    }

    @Transactional
    public void markRead(UUID id, UUID userId) {
        repo.markRead(id, userId);
    }

    @Transactional
    public void markAllRead(UUID userId) {
        repo.markAllRead(userId);
    }

    @Transactional
    public void markReportRead(UUID reportId, UUID userId) {
        repo.markReportRead(reportId, userId);
    }

    @Transactional(readOnly = true)
    public boolean emailEnabled(UUID userId) {
        return repo.emailEnabledFor(userId);
    }

    @Transactional
    public void setEmailEnabled(UUID userId, boolean enabled) {
        repo.setEmailEnabled(userId, enabled);
    }

    @Transactional(readOnly = true)
    public boolean slackEnabled(UUID userId) {
        return repo.slackEnabledFor(userId);
    }

    @Transactional
    public void setSlackEnabled(UUID userId, boolean enabled) {
        repo.setSlackEnabled(userId, enabled);
    }

    // ------------------------------------------------------------------

    private void send(Collection<UUID> recipients, AuthUser actor, Type type, UUID reportId, UUID commentId,
                      String title, String body) {
        for (UUID userId : recipients) {
            if (userId != null && !userId.equals(actor.id())) {
                repo.insert(userId, type, reportId, commentId, actor.id(), title, body);
            }
        }
    }

    private static Set<UUID> people(UUID... ids) {
        Set<UUID> set = new LinkedHashSet<>();
        for (UUID id : ids) {
            if (id != null) set.add(id);
        }
        return set;
    }

    private static String label(String status) {
        return status == null ? "—" : STATUS.getOrDefault(status, status);
    }
}
