package az.bugtrack.share;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import az.bugtrack.access.Permissions;
import az.bugtrack.common.ApiException;
import az.bugtrack.config.AppProperties;
import az.bugtrack.eav.EavRepository;
import az.bugtrack.integration.SecretCipher;
import az.bugtrack.project.ProjectAccess;
import az.bugtrack.report.ReportDtos.ReportDetails;
import az.bugtrack.report.ReportRepository;
import az.bugtrack.security.AuthUser;
import az.bugtrack.settings.SettingsService;
import az.bugtrack.storage.FileRepository;
import az.bugtrack.storage.FileUrlSigner;

/**
 * Public links: a report opened by link without signing in, read-only, until the link expires
 * or is revoked. Needs the report.share permission and the global "sharing.enabled" setting.
 */
@Service
public class ShareService {

    private static final SecureRandom RANDOM = new SecureRandom();

    public record ShareDto(UUID id, String url, OffsetDateTime createdAt, OffsetDateTime expiresAt, String createdByName,
                           int views, OffsetDateTime lastViewedAt) {
    }

    /** Active links for the admin list. */
    public record ShareRow(UUID id, UUID reportId, String reportTitle, String projectKey, String createdByName,
                           OffsetDateTime createdAt, OffsetDateTime expiresAt, int views, OffsetDateTime lastViewedAt) {
    }

    private record Found(UUID id, UUID reportId) {
    }

    private final JdbcClient jdbc;
    private final SecretCipher cipher;
    private final SettingsService settings;
    private final ReportRepository reports;
    private final ProjectAccess access;
    private final EavRepository eav;
    private final FileRepository files;
    private final FileUrlSigner signer;
    private final AppProperties props;

    public ShareService(JdbcClient jdbc, SecretCipher cipher, SettingsService settings, ReportRepository reports,
                        ProjectAccess access, EavRepository eav, FileRepository files, FileUrlSigner signer,
                        AppProperties props) {
        this.jdbc = jdbc;
        this.cipher = cipher;
        this.settings = settings;
        this.reports = reports;
        this.access = access;
        this.eav = eav;
        this.files = files;
        this.signer = signer;
        this.props = props;
    }

    // ----------------------------- for signed-in users -----------------------------

    @Transactional(readOnly = true)
    public Optional<ShareDto> current(AuthUser me, UUID reportId) {
        requireReport(me, reportId);
        return active(reportId);
    }

    /** Creates a link, or changes the expiry of the existing one. days == null: the default. */
    @Transactional
    public ShareDto share(AuthUser me, UUID reportId, Integer days) {
        if (!settings.bool(SettingsService.SHARING_ENABLED)) {
            throw ApiException.forbidden("Public links are turned off by an administrator");
        }
        if (!me.has(Permissions.REPORT_SHARE)) {
            throw ApiException.forbidden("Your role cannot share reports");
        }
        requireReport(me, reportId);
        int max = settings.integer(SettingsService.SHARING_MAX_DAYS);
        int d = days == null ? settings.integer(SettingsService.SHARING_DEFAULT_DAYS) : days;
        if (d < 1 || d > max) {
            throw ApiException.badRequest("INVALID_EXPIRY", "The link can live from 1 to " + max + " days");
        }
        OffsetDateTime expires = OffsetDateTime.now().plusDays(d);
        Optional<ShareDto> existing = active(reportId);
        if (existing.isPresent()) {
            jdbc.sql("UPDATE report_share SET expires_at = :e WHERE id = :id")
                    .param("e", expires).param("id", existing.get().id()).update();
        } else {
            String token = randomToken();
            jdbc.sql("""
                    INSERT INTO report_share (report_id, token_hash, token_enc, created_by, expires_at)
                    VALUES (:r, :hash, :enc, :by, :e)
                    """)
                    .param("r", reportId)
                    .param("hash", sha256(token))
                    .param("enc", cipher.encrypt(token))
                    .param("by", me.id())
                    .param("e", expires)
                    .update();
        }
        return active(reportId).orElseThrow();
    }

    @Transactional
    public void revoke(AuthUser me, UUID reportId) {
        requireReport(me, reportId);
        if (!me.has(Permissions.REPORT_SHARE)) {
            throw ApiException.forbidden("Your role cannot share reports");
        }
        jdbc.sql("UPDATE report_share SET revoked_at = now(), revoked_by = :me WHERE report_id = :r AND revoked_at IS NULL")
                .param("me", me.id()).param("r", reportId).update();
    }

    @Transactional(readOnly = true)
    public List<ShareRow> activeAll() {
        return jdbc.sql("""
                SELECT s.id, s.report_id, c.title, c.project_key, u.full_name, s.created_at, s.expires_at, s.views,
                       s.last_viewed_at
                  FROM report_share s
                  JOIN v_report_card_all c ON c.id = s.report_id
                  LEFT JOIN app_user u ON u.id = s.created_by
                 WHERE s.revoked_at IS NULL AND s.expires_at > now()
                 ORDER BY s.created_at DESC
                 LIMIT 500
                """)
                .query((rs, i) -> new ShareRow(rs.getObject("id", UUID.class), rs.getObject("report_id", UUID.class),
                        rs.getString("title"), rs.getString("project_key"), rs.getString("full_name"),
                        rs.getObject("created_at", OffsetDateTime.class), rs.getObject("expires_at", OffsetDateTime.class),
                        rs.getInt("views"), rs.getObject("last_viewed_at", OffsetDateTime.class)))
                .list();
    }

    @Transactional
    public void revokeById(AuthUser me, UUID shareId) {
        jdbc.sql("UPDATE report_share SET revoked_at = now(), revoked_by = :me WHERE id = :id AND revoked_at IS NULL")
                .param("me", me.id()).param("id", shareId).update();
    }

    // ----------------------------- public -----------------------------

    /** The report behind a valid link; logs the view. Everything else looks like "not found". */
    @Transactional
    public ReportDetails open(String token, String ip, String userAgent) {
        Found f = find(token);
        jdbc.sql("UPDATE report_share SET views = views + 1, last_viewed_at = now() WHERE id = :id")
                .param("id", f.id()).update();
        jdbc.sql("INSERT INTO report_share_view (share_id, ip, user_agent) VALUES (:id, :ip, :ua)")
                .param("id", f.id())
                .param("ip", ip)
                .param("ua", userAgent == null ? null : userAgent.substring(0, Math.min(userAgent.length(), 400)))
                .update();
        ReportRepository.Header h = reports.header(f.reportId()).orElseThrow(() -> ApiException.notFound("Report"));
        return new ReportDetails(h.id(), h.project(), h.service(), h.author(), h.createdAt(), h.updatedAt(), null,
                eav.valuesJson(f.reportId()), reports.summary(f.reportId()),
                files.listByEntities(List.of(f.reportId())).stream()
                        .filter(x -> x.kind() != FileRepository.Kind.ATTACHMENT)
                        .map(signer::toDto).toList(),
                false, false);
    }

    @Transactional(readOnly = true)
    public String events(String token) {
        Found f = find(token);
        return reports.eventsJson(f.reportId(), "", settings.bool(SettingsService.SHARING_NETWORK_BODIES));
    }

    // ------------------------------------------------------------------

    private Found find(String token) {
        if (token == null || token.length() < 20 || !settings.bool(SettingsService.SHARING_ENABLED)) {
            throw ApiException.notFound("Link");
        }
        return jdbc.sql("""
                SELECT s.id, s.report_id FROM report_share s
                  JOIN entity e ON e.id = s.report_id AND e.deleted_at IS NULL
                 WHERE s.token_hash = :h AND s.revoked_at IS NULL AND s.expires_at > now()
                """)
                .param("h", sha256(token))
                .query((rs, i) -> new Found(rs.getObject("id", UUID.class), rs.getObject("report_id", UUID.class)))
                .optional()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "LINK_EXPIRED",
                        "The link has expired or was turned off"));
    }

    private Optional<ShareDto> active(UUID reportId) {
        String base = props.publicUrl().replaceAll("/+$", "");
        return jdbc.sql("""
                SELECT s.id, s.token_enc, s.created_at, s.expires_at, u.full_name, s.views, s.last_viewed_at
                  FROM report_share s LEFT JOIN app_user u ON u.id = s.created_by
                 WHERE s.report_id = :r AND s.revoked_at IS NULL AND s.expires_at > now()
                 ORDER BY s.created_at DESC LIMIT 1
                """)
                .param("r", reportId)
                .query((rs, i) -> new ShareDto(rs.getObject("id", UUID.class),
                        base + "/s/" + cipher.decrypt(rs.getString("token_enc")),
                        rs.getObject("created_at", OffsetDateTime.class), rs.getObject("expires_at", OffsetDateTime.class),
                        rs.getString("full_name"), rs.getInt("views"), rs.getObject("last_viewed_at", OffsetDateTime.class)))
                .optional();
    }

    private void requireReport(AuthUser me, UUID reportId) {
        ReportRepository.Header h = reports.header(reportId).orElseThrow(() -> ApiException.notFound("Report"));
        if (h.project() != null) access.requireReadable(me, h.project().id());
        if (h.deletedAt() != null) throw ApiException.badRequest("REPORT_DELETED", "The report is deleted");
    }

    private static String randomToken() {
        byte[] b = new byte[24];
        RANDOM.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    private static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
