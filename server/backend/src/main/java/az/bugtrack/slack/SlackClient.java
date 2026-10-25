package az.bugtrack.slack;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import az.bugtrack.common.ApiException;

/**
 * Slack Web API with a bot token (xoxb-…). Scopes: chat:write, users:read, users:read.email.
 * The base URL can be changed (SLACK_API_URL) for a corporate proxy or tests.
 */
@Component
public class SlackClient {

    public record Team(String team, String botUser) {
    }

    private final String baseUrl;

    public SlackClient(org.springframework.core.env.Environment env) {
        this.baseUrl = env.getProperty("SLACK_API_URL", "https://slack.com/api").replaceAll("/+$", "");
    }

    private RestClient client(String token) {
        var f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(Duration.ofSeconds(10));
        f.setReadTimeout(Duration.ofSeconds(20));
        return RestClient.builder().baseUrl(baseUrl).requestFactory(f)
                .defaultHeader("Authorization", "Bearer " + token).build();
    }

    public Team test(String token) {
        Map<String, Object> r = call(token, "auth.test", Map.of());
        return new Team(String.valueOf(r.get("team")), String.valueOf(r.get("user")));
    }

    /** Slack user ID by e-mail, or null when nobody in the workspace has it. */
    @SuppressWarnings("unchecked")
    public String userIdByEmail(String token, String email) {
        try {
            Map<String, Object> r = client(token).get()
                    .uri(u -> u.path("/users.lookupByEmail").queryParam("email", email).build())
                    .retrieve().body(Map.class);
            if (r == null || !Boolean.TRUE.equals(r.get("ok"))) return null;
            return String.valueOf(((Map<String, Object>) r.get("user")).get("id"));
        } catch (RestClientException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "SLACK_UNREACHABLE", "Slack cannot be reached: " + e.getMessage());
        }
    }

    /** channel: a channel ID (C…) or a user ID (U…) for a direct message. */
    public void post(String token, String channel, String text, List<Map<String, Object>> blocks) {
        call(token, "chat.postMessage", blocks == null
                ? Map.of("channel", channel, "text", text, "unfurl_links", false)
                : Map.of("channel", channel, "text", text, "blocks", blocks, "unfurl_links", false));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> call(String token, String method, Map<String, Object> body) {
        Map<String, Object> r;
        try {
            r = client(token).post().uri("/" + method).contentType(MediaType.APPLICATION_JSON)
                    .body(body).retrieve().body(Map.class);
        } catch (RestClientException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "SLACK_UNREACHABLE", "Slack cannot be reached: " + e.getMessage());
        }
        if (r == null || !Boolean.TRUE.equals(r.get("ok"))) {
            String err = r == null ? "empty answer" : String.valueOf(r.get("error"));
            String hint = switch (err) {
                case "invalid_auth", "not_authed", "token_revoked", "account_inactive" -> "the bot token is wrong or revoked";
                case "channel_not_found" -> "channel not found — use the channel ID (C…)";
                case "not_in_channel" -> "invite the bot to the channel first (/invite @bot)";
                case "missing_scope" -> "the Slack app needs the scopes chat:write, users:read, users:read.email";
                default -> err;
            };
            throw new ApiException(HttpStatus.BAD_GATEWAY, "SLACK_ERROR", "Slack: " + hint);
        }
        return r;
    }
}
