package az.bugtrack.slack;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import az.bugtrack.common.ApiException;
import az.bugtrack.config.AppProperties;
import az.bugtrack.integration.SecretCipher;
import az.bugtrack.security.AuthUser;

/**
 * Slack:
 *   - new reports are posted to the project's channel (or the default channel);
 *   - personal notifications (mentions, assignments, status changes, comments) go as direct messages,
 *     the Slack user is found by the same e-mail. People can turn this off in My profile.
 * Messages are sent in the background, so Slack being slow never slows the site down.
 */
@Service
public class SlackService {

    private static final Logger log = LoggerFactory.getLogger(SlackService.class);

    public record Status(boolean configured, String teamName, String defaultChannel, OffsetDateTime updatedAt) {
    }

    public record ConnectionRequest(String botToken, String defaultChannel) {
    }

    private record Conn(String token, String teamName, String defaultChannel, OffsetDateTime updatedAt) {
    }

    private record PendingDm(UUID id, UUID userId, String email, String slackUserId, boolean wants, boolean active,
                             UUID reportId, String title, String body) {
    }

    private final JdbcClient jdbc;
    private final SlackClient client;
    private final SecretCipher cipher;
    private final TransactionTemplate tx;
    private final AppProperties props;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "slack");
        t.setDaemon(true);
        return t;
    });

    public SlackService(JdbcClient jdbc, SlackClient client, SecretCipher cipher, TransactionTemplate tx,
                        AppProperties props) {
        this.jdbc = jdbc;
        this.client = client;
        this.cipher = cipher;
        this.tx = tx;
        this.props = props;
    }

    // ----------------------------- admin -----------------------------

    public Status status() {
        return conn().map(c -> new Status(true, c.teamName(), c.defaultChannel(), c.updatedAt()))
                .orElse(new Status(false, null, null, null));
    }

    public Status save(AuthUser me, ConnectionRequest req) {
        Optional<Conn> current = conn();
        String token = req.botToken() != null && !req.botToken().isBlank() ? req.botToken().trim()
                : current.map(Conn::token).orElseThrow(() -> ApiException.badRequest("TOKEN_REQUIRED", "Enter the bot token"));
        if (!token.startsWith("xoxb-")) {
            throw ApiException.badRequest("SLACK_TOKEN", "A bot token starts with xoxb-");
        }
        SlackClient.Team team = client.test(token);
        String channel = req.defaultChannel() == null || req.defaultChannel().isBlank() ? null : req.defaultChannel().trim();
        tx.executeWithoutResult(s -> jdbc.sql("""
                INSERT INTO slack_connection (id, bot_token_enc, team_name, default_channel, updated_by)
                VALUES (1, :t, :team, :ch, :by)
                ON CONFLICT (id) DO UPDATE SET bot_token_enc = EXCLUDED.bot_token_enc, team_name = EXCLUDED.team_name,
                       default_channel = EXCLUDED.default_channel, updated_by = EXCLUDED.updated_by
                """)
                .param("t", cipher.encrypt(token)).param("team", team.team()).param("ch", channel).param("by", me.id())
                .update());
        return status();
    }

    public void delete() {
        tx.executeWithoutResult(s -> jdbc.sql("DELETE FROM slack_connection").update());
    }

    /** Sends a test message to a channel (or the default channel). */
    public void test(String channel) {
        Conn c = conn().orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "SLACK_NOT_CONFIGURED", "Slack is not connected"));
        String ch = channel != null && !channel.isBlank() ? channel.trim() : c.defaultChannel();
        if (ch == null) throw ApiException.badRequest("CHANNEL_REQUIRED", "Enter a channel ID");
        client.post(c.token(), ch, "Bug Stream is connected :white_check_mark:", null);
    }

    public void setProjectChannel(UUID projectId, String channel) {
        jdbc.sql("UPDATE project SET slack_channel = :c WHERE id = :p")
                .param("p", projectId).param("c", channel == null || channel.isBlank() ? null : channel.trim()).update();
    }

    public String projectChannel(UUID projectId) {
        return jdbc.sql("SELECT slack_channel FROM project WHERE id = :p").param("p", projectId)
                .query(String.class).optional().orElse(null);
    }

    public boolean configured() {
        return conn().isPresent();
    }

    // ----------------------------- new report → channel -----------------------------

    /** Called inside the report transaction; the message goes out after commit. */
    public void reportCreated(UUID reportId, UUID projectId, String title, String authorName, String environment) {
        if (projectId == null || !TransactionSynchronizationManager.isSynchronizationActive()) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                executor.submit(() -> postReport(reportId, projectId, title, authorName, environment));
            }
        });
    }

    private void postReport(UUID reportId, UUID projectId, String title, String authorName, String environment) {
        try {
            Optional<Conn> c = conn();
            if (c.isEmpty()) return;
            String channel = Optional.ofNullable(projectChannel(projectId)).orElse(c.get().defaultChannel());
            if (channel == null) return;
            String key = jdbc.sql("SELECT key FROM project WHERE id = :p").param("p", projectId).query(String.class).single();
            String link = props.publicUrl().replaceAll("/+$", "") + "/reports/" + reportId;
            String text = ":beetle: *" + escape(key) + "* — <" + link + "|" + escape(title) + ">"
                    + "\n" + escape(authorName) + (environment == null ? "" : " · " + escape(environment));
            client.post(c.get().token(), channel, text, List.of(Map.of("type", "section",
                    "text", Map.of("type", "mrkdwn", "text", text))));
        } catch (RuntimeException e) {
            log.warn("Slack channel post failed: {}", e.getMessage());
        }
    }

    // ----------------------------- personal notifications → DM -----------------------------

    @Scheduled(fixedDelay = 30_000, initialDelay = 20_000)
    public void sendPending() {
        Optional<Conn> c = conn();
        if (c.isEmpty()) {
            jdbc.sql("UPDATE notification SET slack_status = 'SKIPPED' WHERE slack_status = 'PENDING'").update();
            return;
        }
        List<PendingDm> pending = jdbc.sql("""
                SELECT n.id, u.id AS user_id, u.email, u.slack_user_id, u.slack_notifications, u.is_active,
                       n.report_id, n.title, n.body
                  FROM notification n JOIN app_user u ON u.id = n.user_id
                 WHERE n.slack_status = 'PENDING'
                 ORDER BY n.id LIMIT 50
                """)
                .query((rs, i) -> new PendingDm(rs.getObject("id", UUID.class), rs.getObject("user_id", UUID.class),
                        rs.getString("email"), rs.getString("slack_user_id"), rs.getBoolean("slack_notifications"),
                        rs.getBoolean("is_active"), rs.getObject("report_id", UUID.class), rs.getString("title"),
                        rs.getString("body")))
                .list();
        for (PendingDm n : pending) {
            String status;
            try {
                if (!n.wants() || !n.active()) {
                    status = "SKIPPED";
                } else {
                    String slackId = n.slackUserId();
                    if (slackId == null) {
                        slackId = client.userIdByEmail(c.get().token(), n.email());
                        if (slackId != null) {
                            jdbc.sql("UPDATE app_user SET slack_user_id = :s WHERE id = :u")
                                    .param("s", slackId).param("u", n.userId()).update();
                        }
                    }
                    if (slackId == null) {
                        status = "SKIPPED";
                    } else {
                        String link = props.publicUrl().replaceAll("/+$", "") + "/reports/" + n.reportId();
                        String text = "<" + link + "|" + escape(n.title()) + ">"
                                + (n.body() == null ? "" : "\n" + escape(n.body()));
                        client.post(c.get().token(), slackId, text, null);
                        status = "SENT";
                    }
                }
            } catch (RuntimeException e) {
                log.warn("Slack message failed: {}", e.getMessage());
                status = "FAILED";
            }
            jdbc.sql("UPDATE notification SET slack_status = :s WHERE id = :id").param("s", status).param("id", n.id()).update();
        }
    }

    // ------------------------------------------------------------------

    private Optional<Conn> conn() {
        return jdbc.sql("SELECT bot_token_enc, team_name, default_channel, updated_at FROM slack_connection WHERE id = 1")
                .query((rs, i) -> new Conn(cipher.decrypt(rs.getString("bot_token_enc")), rs.getString("team_name"),
                        rs.getString("default_channel"), rs.getObject("updated_at", OffsetDateTime.class)))
                .optional();
    }

    /** Slack mrkdwn escaping. */
    private static String escape(String s) {
        return s == null ? "" : s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
