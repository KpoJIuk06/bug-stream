package az.bugtrack.mail;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Optional;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import az.bugtrack.common.ApiException;
import az.bugtrack.config.AppProperties;
import az.bugtrack.integration.SecretCipher;
import jakarta.mail.internet.MimeMessage;

/**
 * Outgoing e-mail through your own SMTP server: sign-in codes, password reset and invitation links,
 * notifications. The server is set in Administration → E-mail (SMTP); until then SMTP_* from .env are used.
 * The SMTP password is stored encrypted and never returned by the API.
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    /** source: DB — set in the admin panel; ENV — from .env; NONE — e-mail is off. */
    public record MailStatus(boolean configured, String source, String host, Integer port, String security,
                             String username, boolean passwordSet, String fromAddress, String fromName,
                             OffsetDateTime updatedAt) {
    }

    /** password: empty = keep the saved one. */
    public record MailRequest(String host, Integer port, String security, String username, String password,
                              String fromAddress, String fromName) {
    }

    record Config(String source, String host, int port, String security, String username, String password,
                  String fromAddress, String fromName, OffsetDateTime updatedAt) {
    }

    private final JdbcClient jdbc;
    private final SecretCipher cipher;
    private final AppProperties props;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "mail");
        t.setDaemon(true);
        return t;
    });

    private volatile Config cachedConfig;
    private volatile JavaMailSenderImpl cachedSender;

    public MailService(JdbcClient jdbc, SecretCipher cipher, AppProperties props) {
        this.jdbc = jdbc;
        this.cipher = cipher;
        this.props = props;
    }

    // ----------------------------- sending -----------------------------

    public boolean isConfigured() {
        return config().isPresent();
    }

    /** Sends now; throws when SMTP is off or the server refuses. */
    public void send(String to, String subject, String text, String html) {
        Config c = config().orElseThrow(() -> ApiException.conflict("MAIL_NOT_CONFIGURED",
                "E-mail is not configured — set the SMTP server in Administration → E-mail"));
        try {
            JavaMailSenderImpl sender = sender(c);
            MimeMessage msg = sender.createMimeMessage();
            MimeMessageHelper h = new MimeMessageHelper(msg, html != null, StandardCharsets.UTF_8.name());
            if (c.fromName() != null && !c.fromName().isBlank()) {
                h.setFrom(c.fromAddress(), c.fromName());
            } else {
                h.setFrom(c.fromAddress());
            }
            h.setTo(to);
            h.setSubject(subject);
            if (html != null) {
                h.setText(text, html);
            } else {
                h.setText(text);
            }
            sender.send(msg);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new MailFailure(e);
        }
    }

    /**
     * Sends in the background: the HTTP answer does not wait for SMTP, and its timing does not reveal
     * whether the address exists (sign-in codes, password reset).
     */
    public void sendLater(String to, String subject, String text, String html) {
        executor.submit(() -> {
            try {
                send(to, subject, text, html);
            } catch (Exception e) {
                log.warn("Cannot send e-mail \"{}\" to {}: {}", subject, to, rootMessage(e));
            }
        });
    }

    /** SMTP failure with a message that is safe to show to an administrator. */
    public static class MailFailure extends RuntimeException {
        MailFailure(Exception cause) {
            super(rootMessage(cause), cause);
        }
    }

    // ----------------------------- admin -----------------------------

    public MailStatus status() {
        return config().map(c -> new MailStatus(true, c.source(), c.host(), c.port(), c.security(), c.username(),
                        c.password() != null && !c.password().isEmpty(), c.fromAddress(), c.fromName(), c.updatedAt()))
                .orElse(new MailStatus(false, "NONE", null, null, null, null, false, null, null, null));
    }

    @Transactional
    public MailStatus save(MailRequest req, UUID by) {
        String host = trim(req.host());
        String from = trim(req.fromAddress());
        if (host == null) {
            throw ApiException.badRequest("HOST_REQUIRED", "Enter the SMTP server");
        }
        if (from == null || !from.matches("[^@\\s]+@[^@\\s]+")) {
            throw ApiException.badRequest("FROM_REQUIRED", "Enter the sender address, e.g. bugstream@example.com");
        }
        String security = req.security() == null ? "STARTTLS" : req.security().toUpperCase(Locale.ROOT);
        if (!security.equals("NONE") && !security.equals("STARTTLS") && !security.equals("SSL")) {
            throw ApiException.badRequest("INVALID_SECURITY", "Security: NONE, STARTTLS or SSL");
        }
        int port = req.port() == null ? (security.equals("SSL") ? 465 : 587) : req.port();
        if (port < 1 || port > 65535) {
            throw ApiException.badRequest("INVALID_PORT", "Port must be between 1 and 65535");
        }
        String username = trim(req.username());
        String passwordEnc;
        if (req.password() != null && !req.password().isEmpty()) {
            passwordEnc = cipher.encrypt(req.password());
        } else if (username == null) {
            passwordEnc = null;
        } else {
            passwordEnc = jdbc.sql("SELECT password_enc FROM mail_connection WHERE id = 1")
                    .query(String.class).optional().orElse(null);
        }
        jdbc.sql("""
                INSERT INTO mail_connection (id, host, port, security, username, password_enc, from_address, from_name, updated_by)
                VALUES (1, :host, :port, :security, :username, :password, :from, :fromName, :by)
                ON CONFLICT (id) DO UPDATE SET host = EXCLUDED.host, port = EXCLUDED.port, security = EXCLUDED.security,
                       username = EXCLUDED.username, password_enc = EXCLUDED.password_enc,
                       from_address = EXCLUDED.from_address, from_name = EXCLUDED.from_name, updated_by = EXCLUDED.updated_by
                """)
                .param("host", host).param("port", port).param("security", security).param("username", username)
                .param("password", passwordEnc).param("from", from).param("fromName", trim(req.fromName()))
                .param("by", by)
                .update();
        invalidate();
        return status();
    }

    /** Back to SMTP_* from .env (or off). */
    @Transactional
    public MailStatus reset() {
        jdbc.sql("DELETE FROM mail_connection").update();
        invalidate();
        return status();
    }

    // ----------------------------- config -----------------------------

    Optional<Config> config() {
        Config c = cachedConfig;
        if (c == null) {
            c = load();
            cachedConfig = c;
        }
        return c.host() == null ? Optional.empty() : Optional.of(c);
    }

    private Config load() {
        Optional<Config> db = jdbc.sql("""
                SELECT host, port, security, username, password_enc, from_address, from_name, updated_at
                  FROM mail_connection WHERE id = 1
                """)
                .query((rs, i) -> new Config("DB", rs.getString("host"), rs.getInt("port"), rs.getString("security"),
                        rs.getString("username"), decrypt(rs.getString("password_enc")), rs.getString("from_address"),
                        rs.getString("from_name"), rs.getObject("updated_at", OffsetDateTime.class)))
                .optional();
        if (db.isPresent()) {
            return db.get();
        }
        AppProperties.Mail m = props.mail();
        if (m != null && m.enabled()) {
            String security = Boolean.TRUE.equals(m.ssl()) ? "SSL" : Boolean.TRUE.equals(m.starttls()) ? "STARTTLS" : "NONE";
            return new Config("ENV", m.host(), m.port() == null ? 587 : m.port(), security, trim(m.username()),
                    m.password(), m.from(), "Bug Stream", null);
        }
        return new Config("NONE", null, 0, null, null, null, null, null, null);
    }

    private String decrypt(String enc) {
        try {
            return cipher.decrypt(enc);
        } catch (IllegalStateException e) {
            log.error("Cannot decrypt the SMTP password — enter it again in Administration → E-mail");
            return null;
        }
    }

    private synchronized JavaMailSenderImpl sender(Config c) {
        if (cachedSender != null) {
            return cachedSender;
        }
        JavaMailSenderImpl s = new JavaMailSenderImpl();
        s.setHost(c.host());
        s.setPort(c.port());
        boolean auth = c.username() != null && !c.username().isBlank();
        if (auth) {
            s.setUsername(c.username());
            s.setPassword(c.password());
        }
        s.setDefaultEncoding(StandardCharsets.UTF_8.name());
        Properties p = s.getJavaMailProperties();
        p.put("mail.smtp.auth", String.valueOf(auth));
        p.put("mail.smtp.starttls.enable", String.valueOf("STARTTLS".equals(c.security())));
        p.put("mail.smtp.starttls.required", String.valueOf("STARTTLS".equals(c.security())));
        p.put("mail.smtp.ssl.enable", String.valueOf("SSL".equals(c.security())));
        p.put("mail.smtp.connectiontimeout", "10000");
        p.put("mail.smtp.timeout", "15000");
        p.put("mail.smtp.writetimeout", "15000");
        cachedSender = s;
        log.info("E-mail via {}:{} ({}, from {})", c.host(), c.port(), c.security(), c.source());
        return s;
    }

    private synchronized void invalidate() {
        cachedConfig = null;
        cachedSender = null;
    }

    private static String trim(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    static String rootMessage(Throwable e) {
        Throwable t = e;
        while (t.getCause() != null && t.getCause() != t) {
            t = t.getCause();
        }
        String m = t.getMessage();
        return m == null ? t.getClass().getSimpleName() : m.replaceAll("\\s+", " ").trim();
    }
}
