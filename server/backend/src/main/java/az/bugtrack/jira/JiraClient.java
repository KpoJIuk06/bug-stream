package az.bugtrack.jira;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import az.bugtrack.common.ApiException;

/**
 * Jira Cloud REST API v3 with basic auth (Atlassian account e-mail + API token).
 * https://developer.atlassian.com/cloud/jira/platform/rest/v3/
 */
@Component
public class JiraClient {

    public record Credentials(String baseUrl, String email, String token) {
    }

    public record Myself(String accountId, String displayName, String email) {
    }

    /** level: Jira hierarchy level (0 — standard: Bug, Task, Story; 1 — Epic; -1 — sub-task); null when unknown. */
    public record IssueType(String id, String name, boolean subtask, Integer level) {
    }

    /** Issue status: category is new | indeterminate | done (To Do / In Progress / Done). */
    public record IssueStatus(String key, String name, String category) {
    }

    public record SearchPage(List<IssueStatus> issues, String nextPageToken, boolean last) {
    }

    public record RemoteProject(String id, String key, String name, String projectType, String avatarUrl,
                                List<IssueType> issueTypes) {
    }

    public record CreatedIssue(String id, String key, String url) {
    }

    /** Jira rejected the credentials (401): the token is wrong, expired or revoked. */
    public static class BadCredentials extends RuntimeException {
        BadCredentials(String message) {
            super(message);
        }
    }

    private RestClient client(Credentials c) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(40));
        String basic = Base64.getEncoder()
                .encodeToString((c.email().trim() + ":" + c.token().trim()).getBytes(StandardCharsets.UTF_8));
        return RestClient.builder()
                .baseUrl(normalizeUrl(c.baseUrl()))
                .requestFactory(factory)
                .defaultHeader("Authorization", "Basic " + basic)
                .defaultHeader("Accept", "application/json")
                .build();
    }

    @SuppressWarnings("unchecked")
    public Myself myself(Credentials c) {
        Map<String, Object> me = call(() -> client(c).get().uri("/rest/api/3/myself").retrieve().body(Map.class));
        if (me == null) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "JIRA_ERROR", "Jira returned an empty answer");
        }
        return new Myself(str(me.get("accountId")), str(me.get("displayName")), str(me.get("emailAddress")));
    }

    /** All projects visible to the account, with their issue types (paged by 50). */
    @SuppressWarnings("unchecked")
    public List<RemoteProject> projects(Credentials c) {
        List<RemoteProject> out = new ArrayList<>();
        RestClient rc = client(c);
        int startAt = 0;
        for (int guard = 0; guard < 200; guard++) {
            final int from = startAt;
            Map<String, Object> page = call(() -> rc.get()
                    .uri(u -> u.path("/rest/api/3/project/search")
                            .queryParam("startAt", from)
                            .queryParam("maxResults", 50)
                            .queryParam("expand", "issueTypes")
                            .build())
                    .retrieve().body(Map.class));
            if (page == null) break;
            List<Map<String, Object>> values = (List<Map<String, Object>>) page.getOrDefault("values", List.of());
            for (Map<String, Object> p : values) {
                List<IssueType> types = new ArrayList<>();
                for (Map<String, Object> t : (List<Map<String, Object>>) p.getOrDefault("issueTypes", List.of())) {
                    types.add(issueType(t));
                }
                Map<String, Object> avatars = (Map<String, Object>) p.get("avatarUrls");
                out.add(new RemoteProject(str(p.get("id")), str(p.get("key")), str(p.get("name")),
                        str(p.get("projectTypeKey")), avatars == null ? null : str(avatars.get("48x48")), types));
            }
            boolean last = Boolean.TRUE.equals(page.get("isLast")) || values.isEmpty();
            if (last) break;
            startAt += values.size();
        }
        return out;
    }

    /** Issue types available in one project (fresh from Jira). */
    @SuppressWarnings("unchecked")
    public List<IssueType> issueTypes(Credentials c, String projectId) {
        List<Map<String, Object>> list = call(() -> client(c).get()
                .uri(u -> u.path("/rest/api/3/issuetype/project").queryParam("projectId", projectId).build())
                .retrieve().body(List.class));
        List<IssueType> out = new ArrayList<>();
        if (list != null) {
            for (Map<String, Object> t : list) out.add(issueType(t));
        }
        return out;
    }

    /** Status of one issue; null when Jira says it does not exist (or the account cannot see it). */
    @SuppressWarnings("unchecked")
    public IssueStatus issueStatus(Credentials c, String key) {
        try {
            Map<String, Object> issue = call(() -> client(c).get()
                    .uri(u -> u.path("/rest/api/3/issue/{key}").queryParam("fields", "status").build(key))
                    .retrieve().body(Map.class));
            return issue == null ? null : status(issue);
        } catch (ApiException e) {
            if (e.getMessage() != null && e.getMessage().contains("not found")) return null;
            throw e;
        }
    }

    /**
     * One page of a JQL search, only the status field. Uses /rest/api/3/search/jql (nextPageToken);
     * falls back to the older /rest/api/3/search on sites that do not have it yet.
     */
    @SuppressWarnings("unchecked")
    public SearchPage searchStatuses(Credentials c, String jql, String pageToken, int startAt) {
        RestClient rc = client(c);
        Map<String, Object> page;
        boolean legacy = false;
        try {
            page = call(() -> rc.get()
                    .uri(u -> {
                        var b = u.path("/rest/api/3/search/jql").queryParam("jql", jql).queryParam("fields", "status")
                                .queryParam("maxResults", 100);
                        if (pageToken != null) b.queryParam("nextPageToken", pageToken);
                        return b.build();
                    })
                    .retrieve().body(Map.class));
        } catch (ApiException e) {
            if (e.getMessage() == null || !e.getMessage().contains("not found")) throw e;
            legacy = true;
            page = call(() -> rc.get()
                    .uri(u -> u.path("/rest/api/3/search").queryParam("jql", jql).queryParam("fields", "status")
                            .queryParam("maxResults", 100).queryParam("startAt", startAt).build())
                    .retrieve().body(Map.class));
        }
        if (page == null) return new SearchPage(List.of(), null, true);
        List<IssueStatus> out = new ArrayList<>();
        List<Map<String, Object>> issues = (List<Map<String, Object>>) page.getOrDefault("issues", List.of());
        for (Map<String, Object> i : issues) out.add(status(i));
        if (legacy) {
            int total = page.get("total") instanceof Number n ? n.intValue() : 0;
            return new SearchPage(out, null, issues.isEmpty() || startAt + issues.size() >= total);
        }
        String next = str(page.get("nextPageToken"));
        return new SearchPage(out, next, next == null || Boolean.TRUE.equals(page.get("isLast")) || issues.isEmpty());
    }

    /**
     * Creates an issue. Optional fields (priority, environment field) are dropped and the request is
     * repeated once if the project's create screen does not have them.
     */
    @SuppressWarnings("unchecked")
    public CreatedIssue createIssue(Credentials c, Map<String, Object> fields, List<String> optionalFields) {
        RestClient rc = client(c);
        Map<String, Object> body = new LinkedHashMap<>(fields);
        try {
            Map<String, Object> res = call(() -> rc.post().uri("/rest/api/3/issue")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("fields", body))
                    .retrieve().body(Map.class));
            return created(c, res);
        } catch (ApiException e) {
            boolean retried = false;
            for (String f : optionalFields) {
                if (body.containsKey(f) && e.getMessage() != null && e.getMessage().contains(f)) {
                    body.remove(f);
                    retried = true;
                }
            }
            if (!retried) throw e;
            Map<String, Object> res = call(() -> rc.post().uri("/rest/api/3/issue")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("fields", body))
                    .retrieve().body(Map.class));
            return created(c, res);
        }
    }

    /** Best effort: a failed attachment does not fail the issue. */
    public void attach(Credentials c, String issueKey, String fileName, String mime, byte[] bytes) {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add("file", new ByteArrayResource(bytes) {
            @Override
            public String getFilename() {
                return fileName;
            }
        });
        call(() -> client(c).post().uri("/rest/api/3/issue/{key}/attachments", issueKey)
                .header("X-Atlassian-Token", "no-check")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(parts)
                .retrieve().toBodilessEntity());
    }

    // ------------------------------------------------------------------

    private static IssueType issueType(Map<String, Object> t) {
        Integer level = t.get("hierarchyLevel") instanceof Number n ? n.intValue() : null;
        return new IssueType(str(t.get("id")), str(t.get("name")), Boolean.TRUE.equals(t.get("subtask")), level);
    }

    @SuppressWarnings("unchecked")
    private static IssueStatus status(Map<String, Object> issue) {
        Map<String, Object> fields = (Map<String, Object>) issue.getOrDefault("fields", Map.of());
        Map<String, Object> st = (Map<String, Object>) fields.get("status");
        if (st == null) return new IssueStatus(str(issue.get("key")), null, null);
        Map<String, Object> cat = (Map<String, Object>) st.get("statusCategory");
        return new IssueStatus(str(issue.get("key")), str(st.get("name")), cat == null ? null : str(cat.get("key")));
    }

    private CreatedIssue created(Credentials c, Map<String, Object> res) {
        if (res == null || res.get("key") == null) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "JIRA_ERROR", "Jira did not return the issue key");
        }
        String key = str(res.get("key"));
        return new CreatedIssue(str(res.get("id")), key, normalizeUrl(c.baseUrl()) + "/browse/" + key);
    }

    private interface Call<T> {
        T run();
    }

    /** Jira errors → readable messages; 401 → {@link BadCredentials}. */
    private static <T> T call(Call<T> call) {
        try {
            return call.run();
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            if (status == 401) {
                throw new BadCredentials("Jira rejected the e-mail and API token");
            }
            String body = e.getResponseBodyAsString();
            if (body.length() > 600) body = body.substring(0, 600) + "…";
            String hint = switch (status) {
                case 403 -> "no permission for this action in Jira";
                case 404 -> "not found — check the Jira address and the project";
                case 400 -> "Jira did not accept the data";
                default -> "response " + status;
            };
            throw new ApiException(HttpStatus.BAD_GATEWAY, "JIRA_ERROR", "Jira: " + hint + ". " + body);
        } catch (ResourceAccessException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "JIRA_UNREACHABLE",
                    "Jira cannot be reached from the Bug Stream server: " + e.getMostSpecificCause().getMessage());
        } catch (RestClientException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "JIRA_ERROR", "Unexpected answer from Jira: " + e.getMessage());
        }
    }

    /** https://company.atlassian.net (no trailing slash); only http(s) addresses are accepted. */
    public static String normalizeUrl(String url) {
        String u = url == null ? "" : url.trim().replaceAll("/+$", "");
        try {
            URI uri = URI.create(u);
            if (!("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) || uri.getHost() == null) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("INVALID_JIRA_URL", "The Jira address must look like https://company.atlassian.net");
        }
        return u;
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }
}
