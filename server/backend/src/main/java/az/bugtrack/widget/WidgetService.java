package az.bugtrack.widget;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.ArrayDeque;
import java.util.Base64;
import java.util.Deque;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import az.bugtrack.common.ApiException;
import az.bugtrack.project.ProjectAccess;
import az.bugtrack.security.AuthUser;
import az.bugtrack.widget.WidgetKeyRepository.WidgetKey;

/**
 * Site widget keys. A key sits in the site's code and is therefore not a secret — it grants one thing only:
 * sending a report to its project. Protection from other sites: the list of allowed origins,
 * from spam: a limit of reports per hour.
 */
@Service
public class WidgetService {

    public record CreatedKey(WidgetKey key, String rawKey) {
    }

    public record KeyRequest(String name, List<String> allowedOrigins, Boolean enabled) {
    }

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int REPORTS_PER_HOUR = 60;

    private final WidgetKeyRepository keys;
    private final ProjectAccess access;
    private final Map<UUID, Deque<Long>> rate = new ConcurrentHashMap<>();

    public WidgetService(WidgetKeyRepository keys, ProjectAccess access) {
        this.keys = keys;
        this.access = access;
    }

    // ----------------------------- managing keys (the site) -----------------------------

    @Transactional(readOnly = true)
    public List<WidgetKey> list(AuthUser me, UUID projectId) {
        access.requireReadable(me, projectId);
        access.requireManage(me, projectId);
        return keys.listByProject(projectId);
    }

    @Transactional
    public CreatedKey create(AuthUser me, UUID projectId, KeyRequest req) {
        access.requireReadable(me, projectId);
        access.requireManage(me, projectId);
        String raw = "adk_" + Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes(24));
        UUID id = keys.insert(projectId, name(req.name()), sha256(raw), raw.substring(0, 10), origins(req.allowedOrigins()), me.id());
        return new CreatedKey(keys.find(id).orElseThrow(), raw);
    }

    @Transactional
    public WidgetKey update(AuthUser me, UUID id, KeyRequest req) {
        WidgetKey k = requireManageable(me, id);
        keys.update(id, req.name() == null ? k.name() : name(req.name()),
                req.allowedOrigins() == null ? k.allowedOrigins() : origins(req.allowedOrigins()),
                req.enabled() == null ? k.enabled() : req.enabled());
        return keys.find(id).orElseThrow();
    }

    @Transactional
    public void delete(AuthUser me, UUID id) {
        requireManageable(me, id);
        keys.delete(id);
    }

    // ----------------------------- checking a key (widget) -----------------------------

    /** Key from the X-Bug-Stream-Key header + site origin. Errors are 401/403 without details about the project. */
    @Transactional
    public WidgetKey authorize(String rawKey, String origin, boolean countReport) {
        if (rawKey == null || rawKey.isBlank()) {
            throw ApiException.unauthorized("WIDGET_KEY_REQUIRED", "Widget key is required (X-Bug-Stream-Key)");
        }
        WidgetKey k = keys.findActiveByHash(sha256(rawKey.trim()))
                .orElseThrow(() -> ApiException.unauthorized("WIDGET_KEY_INVALID", "Widget key is invalid or disabled"));
        if (!originAllowed(k.allowedOrigins(), origin)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "WIDGET_ORIGIN", "This site is not allowed for the widget key: " + origin);
        }
        if (countReport) {
            Deque<Long> q = rate.computeIfAbsent(k.id(), x -> new ArrayDeque<>());
            synchronized (q) {
                long now = System.currentTimeMillis();
                while (!q.isEmpty() && q.peekFirst() < now - 3_600_000) q.pollFirst();
                if (q.size() >= REPORTS_PER_HOUR) {
                    throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "WIDGET_RATE_LIMIT", "Too many reports from this widget, try later");
                }
                q.addLast(now);
            }
            keys.touch(k.id());
        }
        return k;
    }

    /** Allowed origins: an exact origin ("https://app.example.com") or a pattern with a star ("https://*.example.com"). */
    static boolean originAllowed(List<String> allowed, String origin) {
        if (allowed == null || allowed.isEmpty()) return true;
        if (origin == null || origin.isBlank()) return false;
        String o = origin.toLowerCase().replaceAll("/+$", "");
        for (String a : allowed) {
            String p = a.toLowerCase().trim().replaceAll("/+$", "");
            if (p.equals(o)) return true;
            if (p.contains("*")) {
                String re = ("\\Q" + p + "\\E").replace("*", "\\E[^/]*\\Q");
                if (o.matches(re)) return true;
            }
        }
        return false;
    }

    // ------------------------------------------------------------------

    private WidgetKey requireManageable(AuthUser me, UUID id) {
        WidgetKey k = keys.find(id).orElseThrow(() -> ApiException.notFound("Widget key"));
        access.requireReadable(me, k.projectId());
        access.requireManage(me, k.projectId());
        return k;
    }

    private static String name(String name) {
        if (name == null || name.isBlank()) throw ApiException.badRequest("VALIDATION", "Enter the key name");
        String n = name.trim();
        if (n.length() > 100) throw ApiException.badRequest("VALIDATION", "The name is longer than 100 characters");
        return n;
    }

    private static List<String> origins(List<String> list) {
        if (list == null) return List.of();
        List<String> out = list.stream().map(String::trim).filter(s -> !s.isEmpty()).map(s -> s.replaceAll("/+$", "")).distinct().toList();
        for (String o : out) {
            if (!o.matches("^https?://[^/\\s]+$")) {
                throw ApiException.badRequest("VALIDATION", "A site origin is only scheme and host, e.g. https://app.example.com or http://localhost:3000: " + o);
            }
        }
        if (out.size() > 50) throw ApiException.badRequest("VALIDATION", "No more than 50 origins");
        return out;
    }

    private static byte[] randomBytes(int n) {
        byte[] b = new byte[n];
        RANDOM.nextBytes(b);
        return b;
    }

    static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
