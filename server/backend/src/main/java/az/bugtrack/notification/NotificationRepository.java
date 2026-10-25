package az.bugtrack.notification;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class NotificationRepository {

    public enum Type { MENTION, ASSIGNED, STATUS_CHANGED, COMMENT, REPORT_CREATED }

    /** title/body are English texts (also used for e-mails); the site builds a translated line from type + names. */
    public record NotificationDto(UUID id, Type type, UUID reportId, UUID commentId, UUID actorId, String actorName,
                                  String reportTitle, String title, String body, OffsetDateTime createdAt,
                                  OffsetDateTime readAt) {
    }

    /** An e-mail waiting to be sent. */
    public record PendingEmail(UUID id, String email, String fullName, boolean wantsEmail, boolean active,
                               UUID reportId, String title, String body, String actorName, int attempts) {
    }

    /** People involved in a report — who gets notifications. */
    public record ReportPeople(String title, UUID authorId, UUID assigneeId, UUID projectId) {
    }

    private final JdbcClient jdbc;

    public NotificationRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(UUID userId, Type type, UUID reportId, UUID commentId, UUID actorId, String title, String body) {
        jdbc.sql("""
                INSERT INTO notification (user_id, type, report_id, comment_id, actor_id, title, body)
                VALUES (:user, :type, :report, :comment, :actor, :title, :body)
                """)
                .param("user", userId)
                .param("type", type.name())
                .param("report", reportId)
                .param("comment", commentId)
                .param("actor", actorId)
                .param("title", title)
                .param("body", body)
                .update();
    }

    public List<NotificationDto> list(UUID userId, boolean unreadOnly, int limit) {
        return jdbc.sql("""
                SELECT n.id, n.type, n.report_id, n.comment_id, n.actor_id, u.full_name AS actor_name,
                       c.title AS report_title, n.title, n.body, n.created_at, n.read_at
                  FROM notification n
                  LEFT JOIN app_user u ON u.id = n.actor_id
                  LEFT JOIN v_report_card_all c ON c.id = n.report_id
                 WHERE n.user_id = :user AND (NOT :unreadOnly OR n.read_at IS NULL)
                 ORDER BY n.id DESC
                 LIMIT :limit
                """)
                .param("user", userId)
                .param("unreadOnly", unreadOnly)
                .param("limit", limit)
                .query((rs, i) -> new NotificationDto(
                        rs.getObject("id", UUID.class),
                        Type.valueOf(rs.getString("type")),
                        rs.getObject("report_id", UUID.class),
                        rs.getObject("comment_id", UUID.class),
                        rs.getObject("actor_id", UUID.class),
                        rs.getString("actor_name"),
                        rs.getString("report_title"),
                        rs.getString("title"),
                        rs.getString("body"),
                        rs.getObject("created_at", OffsetDateTime.class),
                        rs.getObject("read_at", OffsetDateTime.class)))
                .list();
    }

    public long unreadCount(UUID userId) {
        return jdbc.sql("SELECT count(*) FROM notification WHERE user_id = :user AND read_at IS NULL")
                .param("user", userId)
                .query(Long.class)
                .single();
    }

    public void markRead(UUID id, UUID userId) {
        jdbc.sql("UPDATE notification SET read_at = now() WHERE id = :id AND user_id = :user AND read_at IS NULL")
                .param("id", id)
                .param("user", userId)
                .update();
    }

    public void markAllRead(UUID userId) {
        jdbc.sql("UPDATE notification SET read_at = now() WHERE user_id = :user AND read_at IS NULL")
                .param("user", userId)
                .update();
    }

    /** The report was opened — its notifications count as read. */
    public void markReportRead(UUID reportId, UUID userId) {
        jdbc.sql("UPDATE notification SET read_at = now() WHERE report_id = :r AND user_id = :user AND read_at IS NULL")
                .param("r", reportId)
                .param("user", userId)
                .update();
    }

    // ----------------------------- e-mail -----------------------------

    public List<PendingEmail> pendingEmails(int limit) {
        return jdbc.sql("""
                SELECT n.id, u.email, u.full_name, u.email_notifications, u.is_active,
                       n.report_id, n.title, n.body, a.full_name AS actor_name, n.email_attempts
                  FROM notification n
                  JOIN app_user u ON u.id = n.user_id
                  LEFT JOIN app_user a ON a.id = n.actor_id
                 WHERE n.email_status = 'PENDING'
                 ORDER BY n.id
                 LIMIT :limit
                """)
                .param("limit", limit)
                .query((rs, i) -> new PendingEmail(
                        rs.getObject("id", UUID.class),
                        rs.getString("email"),
                        rs.getString("full_name"),
                        rs.getBoolean("email_notifications"),
                        rs.getBoolean("is_active"),
                        rs.getObject("report_id", UUID.class),
                        rs.getString("title"),
                        rs.getString("body"),
                        rs.getString("actor_name"),
                        rs.getInt("email_attempts")))
                .list();
    }

    public void setEmailStatus(UUID id, String status, boolean attempted) {
        jdbc.sql("""
                UPDATE notification
                   SET email_status = :status,
                       email_attempts = email_attempts + CASE WHEN :attempted THEN 1 ELSE 0 END,
                       emailed_at = CASE WHEN :status = 'SENT' THEN now() ELSE emailed_at END
                 WHERE id = :id
                """)
                .param("id", id)
                .param("status", status)
                .param("attempted", attempted)
                .update();
    }

    public void skipAllPending() {
        jdbc.sql("UPDATE notification SET email_status = 'SKIPPED' WHERE email_status = 'PENDING'").update();
    }

    // ----------------------------- recipients -----------------------------

    public Optional<ReportPeople> reportPeople(UUID reportId) {
        return jdbc.sql("""
                SELECT e.project_id, e.created_by,
                       (SELECT v.v_string FROM entity_value v JOIN attribute a ON a.id = v.attribute_id
                         WHERE v.entity_id = e.id AND a.code = 'title' AND a.project_id IS NULL LIMIT 1) AS title,
                       (SELECT v.v_uuid FROM entity_value v JOIN attribute a ON a.id = v.attribute_id
                         WHERE v.entity_id = e.id AND a.code = 'assignee_id' AND a.project_id IS NULL LIMIT 1) AS assignee
                  FROM entity e
                 WHERE e.id = :id
                """)
                .param("id", reportId)
                .query((rs, i) -> new ReportPeople(
                        rs.getString("title"),
                        rs.getObject("created_by", UUID.class),
                        rs.getObject("assignee", UUID.class),
                        rs.getObject("project_id", UUID.class)))
                .optional();
    }

    /** Project owners and maintainers — they are notified about new reports. */
    public List<UUID> projectManagers(UUID projectId) {
        return jdbc.sql("""
                SELECT m.user_id FROM project_member m JOIN app_user u ON u.id = m.user_id
                 WHERE m.project_id = :p AND m.role IN ('OWNER', 'MAINTAINER') AND u.is_active
                """)
                .param("p", projectId)
                .query(UUID.class)
                .list();
    }

    public boolean emailEnabledFor(UUID userId) {
        return jdbc.sql("SELECT email_notifications FROM app_user WHERE id = :id")
                .param("id", userId)
                .query(Boolean.class)
                .optional()
                .orElse(false);
    }

    public void setEmailEnabled(UUID userId, boolean enabled) {
        jdbc.sql("UPDATE app_user SET email_notifications = :e WHERE id = :id")
                .param("id", userId)
                .param("e", enabled)
                .update();
    }

    public boolean slackEnabledFor(UUID userId) {
        return jdbc.sql("SELECT slack_notifications FROM app_user WHERE id = :id")
                .param("id", userId)
                .query(Boolean.class)
                .optional()
                .orElse(false);
    }

    public void setSlackEnabled(UUID userId, boolean enabled) {
        jdbc.sql("UPDATE app_user SET slack_notifications = :e WHERE id = :id")
                .param("id", userId)
                .param("e", enabled)
                .update();
    }
}
