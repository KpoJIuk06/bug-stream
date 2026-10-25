package az.bugtrack.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import az.bugtrack.config.AppProperties;
import az.bugtrack.mail.MailLayout;
import az.bugtrack.mail.MailService;
import az.bugtrack.notification.NotificationRepository.PendingEmail;

/**
 * Sends notification e-mails. Runs in the background every 30 seconds, so a slow or unavailable
 * SMTP server never slows the site down. A failed send is retried up to 3 times.
 * No SMTP server (Administration → E-mail or SMTP_* in .env): no e-mails, notifications stay on the site only.
 */
@Component
public class MailNotifier {

    private static final Logger log = LoggerFactory.getLogger(MailNotifier.class);
    private static final int MAX_ATTEMPTS = 3;

    private final NotificationRepository repo;
    private final AppProperties props;
    private final MailService mail;

    public MailNotifier(NotificationRepository repo, AppProperties props, MailService mail) {
        this.repo = repo;
        this.props = props;
        this.mail = mail;
    }

    public boolean isConfigured() {
        return mail.isConfigured();
    }

    @Scheduled(fixedDelay = 30_000, initialDelay = 15_000)
    public void sendPending() {
        if (!mail.isConfigured()) {
            repo.skipAllPending();
            return;
        }
        for (PendingEmail n : repo.pendingEmails(50)) {
            if (!n.wantsEmail() || !n.active() || n.email() == null) {
                repo.setEmailStatus(n.id(), "SKIPPED", false);
                continue;
            }
            try {
                send(n);
                repo.setEmailStatus(n.id(), "SENT", true);
            } catch (Exception e) {
                boolean last = n.attempts() + 1 >= MAX_ATTEMPTS;
                repo.setEmailStatus(n.id(), last ? "FAILED" : "PENDING", true);
                log.warn("Cannot send notification e-mail to {} (attempt {}): {}", n.email(), n.attempts() + 1, e.getMessage());
            }
        }
    }

    private void send(PendingEmail n) {
        String link = props.publicUrl().replaceAll("/+$", "") + "/reports/" + n.reportId();
        String footer = "You can turn these e-mails off on the site: My profile → Notifications.";
        String text = n.title() + "\n\n"
                + (n.body() == null ? "" : n.body() + "\n\n")
                + "Open the report: " + link + "\n\n—\n" + footer;
        String html = MailLayout.html(n.title(), n.body() == null ? "" : MailLayout.p(n.body()), "Open the report", link, footer);
        mail.send(n.email(), "[Bug Stream] " + n.title(), text, html);
    }
}
