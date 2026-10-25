package az.bugtrack.jira;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import az.bugtrack.integration.SecretCipher;
import az.bugtrack.jira.JiraClient.Credentials;
import az.bugtrack.jira.JiraClient.IssueStatus;
import az.bugtrack.jira.JiraClient.SearchPage;
import az.bugtrack.jira.JiraRepository.Connection;

/**
 * Background job: keeps the Jira status of reports up to date (default every 5 minutes, JIRA_STATUS_SYNC).
 * <ol>
 *   <li>links that never got a status (just created) are read one by one;</li>
 *   <li>JQL {@code labels = bugstream AND updated >= -Nm} returns only the issues changed since the last run
 *       (every issue created by Bug Stream has the label "bugstream").</li>
 * </ol>
 * Uses the service account from Administration → Jira; it must be able to browse the linked projects.
 */
@Component
public class JiraStatusSync {

    private static final Logger log = LoggerFactory.getLogger(JiraStatusSync.class);
    private static final int MAX_PAGES = 50;            // 5 000 changed issues per run
    private static final int MAX_SINGLE = 100;          // new links read one by one per run
    private static final long FIRST_RUN_MINUTES = 60L * 24 * 30;

    private final JiraRepository repo;
    private final JiraClient client;
    private final SecretCipher cipher;
    private final TransactionTemplate tx;

    public JiraStatusSync(JiraRepository repo, JiraClient client, SecretCipher cipher, TransactionTemplate tx) {
        this.repo = repo;
        this.client = client;
        this.cipher = cipher;
        this.tx = tx;
    }

    @Scheduled(fixedDelayString = "${app.jira.status-sync:PT5M}", initialDelayString = "${app.jira.status-sync-delay:PT1M}")
    public void run() {
        Optional<Connection> conn = tx.execute(s -> repo.connection());
        if (conn == null || conn.isEmpty()) return;
        Connection c = conn.get();
        Credentials creds;
        try {
            creds = new Credentials(c.baseUrl(), c.serviceEmail(), cipher.decrypt(c.serviceTokenEnc()));
        } catch (IllegalStateException e) {
            log.warn("Jira status sync skipped: {}", e.getMessage());
            return;
        }
        OffsetDateTime started = OffsetDateTime.now();
        try {
            int single = syncNewLinks(creds);
            int changed = syncChanged(creds, c.statusSyncAt(), started);
            tx.executeWithoutResult(s -> repo.statusSyncResult(started, null));
            if (single + changed > 0) {
                log.info("Jira status sync: {} new links read, {} statuses changed", single, changed);
            }
        } catch (RuntimeException e) {
            String msg = e instanceof JiraClient.BadCredentials ? "Jira rejected the service account token" : e.getMessage();
            log.warn("Jira status sync failed: {}", msg);
            tx.executeWithoutResult(s -> repo.statusSyncResult(started, msg == null ? e.getClass().getSimpleName() : msg));
        }
    }

    private int syncNewLinks(Credentials creds) {
        List<String> keys = tx.execute(s -> repo.unsyncedKeys(MAX_SINGLE));
        int n = 0;
        for (String key : keys == null ? List.<String>of() : keys) {
            IssueStatus st = client.issueStatus(creds, key);
            tx.executeWithoutResult(s -> {
                if (st == null) repo.markMissing(key);
                else repo.updateStatus(key, st.name(), st.category());
            });
            n++;
        }
        return n;
    }

    private int syncChanged(Credentials creds, OffsetDateTime last, OffsetDateTime now) {
        long minutes = last == null ? FIRST_RUN_MINUTES
                : Math.min(FIRST_RUN_MINUTES, Duration.between(last, now).toMinutes() + 3);   // +3: clock skew margin
        String jql = "labels = bugstream AND updated >= \"-" + Math.max(minutes, 1) + "m\" ORDER BY updated DESC";
        int changed = 0;
        String token = null;
        int startAt = 0;
        for (int page = 0; page < MAX_PAGES; page++) {
            SearchPage p = client.searchStatuses(creds, jql, token, startAt);
            for (IssueStatus st : p.issues()) {
                Integer c = tx.execute(s -> repo.updateStatus(st.key(), st.name(), st.category()));
                changed += c == null ? 0 : c;
            }
            if (p.last()) break;
            token = p.nextPageToken();
            startAt += p.issues().size();
        }
        return changed;
    }
}
