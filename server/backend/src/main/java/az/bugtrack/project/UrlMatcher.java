package az.bugtrack.project;

import java.net.URI;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

/**
 * Matches a page URL against service patterns. Plain logic without Spring — easy to test.
 *
 * Pattern types:
 *   HOST   — "10.0.0.15:8080" (host and port) or "test.corp.local" (host, any port)
 *   PREFIX — "http://10.0.0.15:8080/admin" — the URL starts with this string (on a path boundary);
 *            the scheme may be omitted: "10.0.0.15:8080/admin"
 *   REGEX  — regular expression, searched in the full URL (case-insensitive)
 *
 * Order: priority (higher first) → PREFIX → HOST with port → HOST without port → REGEX
 * → longer pattern first. The first match is returned.
 */
public final class UrlMatcher {

    public enum MatchType { HOST, PREFIX, REGEX }

    /** A candidate pattern. payload: any data to return on a match (project/service). */
    public record Candidate<T>(MatchType type, String pattern, int priority, T payload) {
    }

    private UrlMatcher() {
    }

    public static <T> Optional<Candidate<T>> match(String url, List<Candidate<T>> candidates) {
        ParsedUrl parsed = ParsedUrl.parse(url);
        if (parsed == null) {
            return Optional.empty();
        }
        return candidates.stream()
                .sorted(ORDER)
                .filter(c -> matches(parsed, c))
                .findFirst();
    }

    /** Validates a pattern before saving. Returns the error text, or null when the pattern is fine. */
    public static String validate(MatchType type, String pattern) {
        if (pattern == null || pattern.isBlank()) {
            return "Pattern is empty";
        }
        String p = pattern.trim();
        return switch (type) {
            case HOST -> p.matches("(?i)[a-z0-9.\\-]+(:\\d{1,5})?") ? null
                    : "HOST pattern must look like 'host' or 'host:port' (no scheme, no path)";
            case PREFIX -> p.contains(" ") ? "PREFIX pattern must not contain spaces" : null;
            case REGEX -> {
                try {
                    Pattern.compile(p);
                    yield null;
                } catch (PatternSyntaxException e) {
                    yield "Invalid regular expression: " + e.getDescription();
                }
            }
        };
    }

    // ------------------------------------------------------------------

    private static final Comparator<Candidate<?>> ORDER = Comparator
            .comparingInt((Candidate<?> c) -> c.priority()).reversed()
            .thenComparing(Comparator.comparingInt(UrlMatcher::typeRank).reversed())
            .thenComparing(Comparator.comparingInt((Candidate<?> c) -> c.pattern().length()).reversed());

    private static int typeRank(Candidate<?> c) {
        return switch (c.type()) {
            case PREFIX -> 4;
            case HOST -> c.pattern().contains(":") ? 3 : 2;
            case REGEX -> 1;
        };
    }

    private static boolean matches(ParsedUrl url, Candidate<?> c) {
        String p = c.pattern().trim();
        return switch (c.type()) {
            case HOST -> matchHost(url, p);
            case PREFIX -> matchPrefix(url, p);
            case REGEX -> matchRegex(url, p);
        };
    }

    private static boolean matchHost(ParsedUrl url, String p) {
        String pl = p.toLowerCase(Locale.ROOT);
        int colon = pl.lastIndexOf(':');
        if (colon > 0) {
            String host = pl.substring(0, colon);
            int port;
            try {
                port = Integer.parseInt(pl.substring(colon + 1));
            } catch (NumberFormatException e) {
                return false;
            }
            return url.host.equals(host) && url.port == port;
        }
        return url.host.equals(pl);
    }

    private static boolean matchPrefix(ParsedUrl url, String p) {
        String pl = p.toLowerCase(Locale.ROOT);
        String target = pl.contains("://") ? url.full : url.withoutScheme;
        String prefix = pl;
        if (!target.startsWith(prefix)) {
            return false;
        }
        // Boundary: "http://host:8080" must not match "http://host:80801/..."
        if (target.length() == prefix.length() || prefix.endsWith("/")) {
            return true;
        }
        char next = target.charAt(prefix.length());
        return next == '/' || next == '?' || next == '#';
    }

    private static boolean matchRegex(ParsedUrl url, String p) {
        try {
            return Pattern.compile(p, Pattern.CASE_INSENSITIVE).matcher(url.original).find();
        } catch (PatternSyntaxException e) {
            return false;
        }
    }

    /** URL in a form convenient for comparison. */
    private record ParsedUrl(String original, String full, String withoutScheme, String host, int port) {

        static ParsedUrl parse(String url) {
            if (url == null || url.isBlank()) {
                return null;
            }
            try {
                URI uri = URI.create(url.trim());
                if (uri.getHost() == null || uri.getScheme() == null) {
                    return null;
                }
                String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
                String host = uri.getHost().toLowerCase(Locale.ROOT);
                int port = uri.getPort() != -1 ? uri.getPort() : ("https".equals(scheme) ? 443 : 80);
                String full = url.trim().toLowerCase(Locale.ROOT);
                String withoutScheme = full.substring(full.indexOf("://") + 3);
                return new ParsedUrl(url.trim(), full, withoutScheme, host, port);
            } catch (IllegalArgumentException e) {
                return null;
            }
        }
    }
}
