package az.bugtrack.project;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

import az.bugtrack.project.UrlMatcher.Candidate;
import az.bugtrack.project.UrlMatcher.MatchType;

class UrlMatcherTest {

    private static final List<Candidate<String>> CANDIDATES = List.of(
            new Candidate<>(MatchType.HOST, "10.0.0.15:8080", 0, "portal"),
            new Candidate<>(MatchType.PREFIX, "http://10.0.0.15:8080/admin", 0, "admin"),
            new Candidate<>(MatchType.HOST, "test.corp.local", 0, "test-any-port"),
            new Candidate<>(MatchType.REGEX, "^https?://stage-[a-z]+\\.corp\\.local/", 0, "stage"),
            new Candidate<>(MatchType.HOST, "10.0.0.20", 0, "api-any-port"),
            new Candidate<>(MatchType.HOST, "10.0.0.20:9000", 0, "api-9000"));

    private static String resolve(String url) {
        return UrlMatcher.match(url, CANDIDATES).map(Candidate::payload).orElse(null);
    }

    @Test
    void hostWithPort() {
        assertEquals("portal", resolve("http://10.0.0.15:8080/runApp?doc=x"));
        assertNull(resolve("http://10.0.0.15:9090/"));
    }

    @Test
    void prefixWinsOverHost() {
        assertEquals("admin", resolve("http://10.0.0.15:8080/admin/users"));
        assertEquals("admin", resolve("HTTP://10.0.0.15:8080/ADMIN"));
        assertEquals("portal", resolve("http://10.0.0.15:8080/administrator"));   // path boundary
    }

    @Test
    void hostWithoutPortMatchesAnyPort() {
        assertEquals("test-any-port", resolve("https://test.corp.local/x"));
        assertEquals("test-any-port", resolve("http://test.corp.local:3000/"));
    }

    @Test
    void hostWithPortIsMoreSpecific() {
        assertEquals("api-9000", resolve("http://10.0.0.20:9000/"));
        assertEquals("api-any-port", resolve("http://10.0.0.20/"));
    }

    @Test
    void regex() {
        assertEquals("stage", resolve("https://stage-hr.corp.local/page"));
        assertNull(resolve("https://prod-hr.corp.local/page"));
    }

    @Test
    void priorityOverridesSpecificity() {
        var list = List.of(
                new Candidate<>(MatchType.PREFIX, "http://a.local/x", 0, "prefix"),
                new Candidate<>(MatchType.REGEX, "a\\.local", 10, "regex-high"));
        assertEquals("regex-high", UrlMatcher.match("http://a.local/x/y", list).map(Candidate::payload).orElse(null));
    }

    @Test
    void invalidUrl() {
        assertNull(resolve("not a url"));
        assertNull(resolve("chrome://extensions"));
        assertNull(resolve(null));
    }

    @Test
    void validation() {
        assertNull(UrlMatcher.validate(MatchType.HOST, "10.0.0.15:8080"));
        assertNotNull(UrlMatcher.validate(MatchType.HOST, "http://10.0.0.15"));
        assertNotNull(UrlMatcher.validate(MatchType.REGEX, "([a-z"));
        assertTrue(UrlMatcher.validate(MatchType.PREFIX, "").startsWith("Pattern"));
    }
}
