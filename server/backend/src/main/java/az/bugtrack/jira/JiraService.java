package az.bugtrack.jira;

import java.io.IOException;
import java.nio.file.Files;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import az.bugtrack.access.Permissions;
import az.bugtrack.common.ApiException;
import az.bugtrack.config.AppProperties;
import az.bugtrack.integration.SecretCipher;
import az.bugtrack.jira.JiraClient.CreatedIssue;
import az.bugtrack.jira.JiraClient.Credentials;
import az.bugtrack.jira.JiraClient.IssueType;
import az.bugtrack.jira.JiraClient.Myself;
import az.bugtrack.jira.JiraClient.RemoteProject;
import az.bugtrack.jira.JiraRepository.Connection;
import az.bugtrack.jira.JiraRepository.ExternalLink;
import az.bugtrack.jira.JiraRepository.JiraProjectRow;
import az.bugtrack.jira.JiraRepository.ProjectLink;
import az.bugtrack.jira.JiraRepository.UserToken;
import az.bugtrack.project.ProjectAccess;
import az.bugtrack.project.ProjectDtos.MemberRole;
import az.bugtrack.project.ProjectDtos.Visibility;
import az.bugtrack.project.ProjectRepository;
import az.bugtrack.report.ReportRepository;
import az.bugtrack.security.AuthUser;
import az.bugtrack.storage.FileRepository;
import az.bugtrack.storage.FileRepository.FileRow;
import az.bugtrack.storage.FileRepository.Kind;
import az.bugtrack.storage.FileStorage;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Jira Cloud:
 *   - the admin connects one Jira site (service account: only reads the list of projects),
 *     syncs the projects and links the needed ones to Bug Stream projects;
 *   - every person adds their own Atlassian API token in "My profile → Jira";
 *     issues are created with that token, so Jira shows the real reporter.
 * HTTP calls to Jira run outside database transactions.
 */
@Service
public class JiraService {

    private static final Logger log = LoggerFactory.getLogger(JiraService.class);
    private static final Map<String, String> PRIORITY = Map.of(
            "CRITICAL", "Highest", "HIGH", "High", "MEDIUM", "Medium", "LOW", "Low");

    public record Status(boolean configured, String baseUrl, String serviceEmail, String defaultIssueType,
                         String environmentField, OffsetDateTime lastSyncAt, String lastSyncError,
                         long projectsCount, long linkedCount, long usersWithTokens,
                         OffsetDateTime statusSyncAt, String statusSyncError) {
    }

    /** An issue type name across the synced projects: in how many linked projects it exists. */
    public record IssueTypeUsage(String name, int linkedProjects, int allProjects) {
    }

    /** Project → Jira & Slack: the link, the types of the Jira project and what will actually be used. */
    public record ProjectJira(boolean configured, String jiraProjectId, String jiraProjectKey, String jiraProjectName,
                              String issueType, String defaultIssueType, List<IssueType> issueTypes,
                              JiraIssueTypes.Choice effective) {
    }

    /** A linked project in Administration → Jira with the issue type its reports will get. */
    public record LinkedProject(UUID projectId, String projectKey, String projectName, String jiraProjectId,
                                String jiraProjectKey, String issueType, List<IssueType> issueTypes,
                                JiraIssueTypes.Choice effective) {
    }

    public record ConnectionRequest(String baseUrl, String email, String token, String defaultIssueType,
                                    String environmentField) {
    }

    public record SyncResult(int total, int added) {
    }

    public record ConnectResult(String jiraKey, UUID projectId, String projectKey, String outcome) {
    }

    /** What the signed-in user sees on "My profile → Jira" and before sending. */
    public record MyJira(boolean configured, String baseUrl, boolean connected, boolean invalid, String email,
                         String displayName, OffsetDateTime verifiedAt) {
    }

    private final JiraRepository repo;
    private final JiraClient client;
    private final SecretCipher cipher;
    private final ProjectRepository projects;
    private final ProjectAccess access;
    private final ReportRepository reports;
    private final FileRepository files;
    private final FileStorage storage;
    private final TransactionTemplate tx;
    private final AppProperties props;
    private final ObjectMapper json;

    public JiraService(JiraRepository repo, JiraClient client, SecretCipher cipher, ProjectRepository projects,
                       ProjectAccess access, ReportRepository reports, FileRepository files, FileStorage storage,
                       TransactionTemplate tx, AppProperties props, ObjectMapper json) {
        this.repo = repo;
        this.client = client;
        this.cipher = cipher;
        this.projects = projects;
        this.access = access;
        this.reports = reports;
        this.files = files;
        this.storage = storage;
        this.tx = tx;
        this.props = props;
        this.json = json;
    }

    // ============================== admin: connection ==============================

    public Status status() {
        return tx.execute(s -> {
            Optional<Connection> c = repo.connection();
            List<JiraProjectRow> all = repo.projects("", "all");
            long linked = all.stream().filter(p -> p.linkedProjectId() != null).count();
            return c.map(x -> new Status(true, x.baseUrl(), x.serviceEmail(), x.defaultIssueType(), x.environmentField(),
                            x.lastSyncAt(), x.lastSyncError(), all.size(), linked, repo.tokensCount(), x.statusSyncAt(),
                            x.statusSyncError()))
                    .orElse(new Status(false, null, null, "Bug", null, null, null, all.size(), linked, repo.tokensCount(),
                            null, null));
        });
    }

    /** Checks the service account against Jira, then saves. An empty token keeps the saved one. */
    public Status saveConnection(AuthUser me, ConnectionRequest req) {
        String url = JiraClient.normalizeUrl(req.baseUrl());
        String email = required(req.email(), "Enter the e-mail of the Jira account");
        Optional<Connection> current = tx.execute(s -> repo.connection());
        String token = req.token() != null && !req.token().isBlank()
                ? req.token().trim()
                : current.map(c -> cipher.decrypt(c.serviceTokenEnc()))
                        .orElseThrow(() -> ApiException.badRequest("TOKEN_REQUIRED", "Enter the API token"));
        try {
            client.myself(new Credentials(url, email, token));
        } catch (JiraClient.BadCredentials e) {
            throw ApiException.badRequest("JIRA_BAD_CREDENTIALS", "Jira rejected the e-mail and API token");
        }
        String issueType = req.defaultIssueType() == null || req.defaultIssueType().isBlank() ? "Bug" : req.defaultIssueType().trim();
        String envField = req.environmentField() == null || req.environmentField().isBlank() ? null : req.environmentField().trim();
        tx.executeWithoutResult(s -> repo.saveConnection(url, email.trim(), cipher.encrypt(token), issueType, envField, me.id()));
        return status();
    }

    public void deleteConnection() {
        tx.executeWithoutResult(s -> repo.deleteConnection());
    }

    public Myself testConnection() {
        Credentials c = serviceCredentials();
        try {
            return client.myself(c);
        } catch (JiraClient.BadCredentials e) {
            throw ApiException.badRequest("JIRA_BAD_CREDENTIALS", "Jira rejected the e-mail and API token");
        }
    }

    /** Loads all Jira projects visible to the service account. */
    public SyncResult sync() {
        Credentials c = serviceCredentials();
        List<RemoteProject> remote;
        try {
            remote = client.projects(c);
        } catch (RuntimeException e) {
            String msg = e instanceof JiraClient.BadCredentials ? "Jira rejected the service account token" : e.getMessage();
            tx.executeWithoutResult(s -> repo.syncResult(msg));
            if (e instanceof JiraClient.BadCredentials) {
                throw ApiException.badRequest("JIRA_BAD_CREDENTIALS", msg);
            }
            throw e;
        }
        // some sites do not return issue types in the project list: ask per project (only where missing)
        List<RemoteProject> filled = new ArrayList<>();
        int asked = 0;
        for (RemoteProject p : remote) {
            if (p.issueTypes().isEmpty() && asked < 300) {
                asked++;
                try {
                    p = new RemoteProject(p.id(), p.key(), p.name(), p.projectType(), p.avatarUrl(), client.issueTypes(c, p.id()));
                } catch (RuntimeException e) {
                    log.debug("Issue types of {} not loaded: {}", p.key(), e.getMessage());
                }
            }
            filled.add(p);
        }
        List<RemoteProject> finalList = filled;
        int added = tx.execute(s -> {
            repo.clearConflictingKeys(finalList);
            int n = repo.upsertProjects(finalList);
            repo.syncResult(null);
            return n;
        });
        log.info("Jira sync: {} projects, {} new", remote.size(), added);
        return new SyncResult(remote.size(), added);
    }

    public List<JiraProjectRow> jiraProjects(String q, String filter) {
        return tx.execute(s -> repo.projects(q, filter));
    }

    /**
     * Links the chosen Jira projects: an existing Bug Stream project with the same key is linked,
     * otherwise a new project is created (the admin becomes its owner).
     */
    public List<ConnectResult> connect(AuthUser me, List<String> jiraIds) {
        return tx.execute(s -> {
            List<ConnectResult> out = new ArrayList<>();
            for (String id : jiraIds) {
                JiraProjectRow jp = repo.project(id).orElseThrow(() -> ApiException.notFound("Jira project " + id));
                if (jp.linkedProjectId() != null) {
                    out.add(new ConnectResult(jp.key(), jp.linkedProjectId(), jp.linkedProjectKey(), "ALREADY_LINKED"));
                    continue;
                }
                String key = bugStreamKey(jp.key());
                Optional<UUID> existing = projects.findIdByKey(key);
                if (existing.isPresent() && repo.link(existing.get()).isEmpty()) {
                    repo.setProjectLink(existing.get(), jp.id(), null);
                    out.add(new ConnectResult(jp.key(), existing.get(), key, "LINKED"));
                    continue;
                }
                String freeKey = key;
                for (int i = 2; projects.findIdByKey(freeKey).isPresent(); i++) {
                    String suffix = "_" + i;
                    freeKey = key.substring(0, Math.min(key.length(), 20 - suffix.length())) + suffix;
                }
                UUID pid = projects.insert(freeKey, jp.name(), "Jira project " + jp.key(), Visibility.PUBLIC, me.id());
                projects.upsertMember(pid, me.id(), MemberRole.OWNER, me.id());
                repo.setProjectLink(pid, jp.id(), null);
                out.add(new ConnectResult(jp.key(), pid, freeKey, "CREATED"));
            }
            return out;
        });
    }

    /** Links (jiraProjectId) or unlinks (null) a Bug Stream project; also sets its issue type. */
    public void setProjectLink(AuthUser me, UUID projectId, String jiraProjectId, String issueType) {
        tx.executeWithoutResult(s -> {
            access.requireReadable(me, projectId);
            if (!me.has(Permissions.INTEGRATION_MANAGE)) {
                access.requireManage(me, projectId);
            }
            if (jiraProjectId != null) {
                repo.project(jiraProjectId).orElseThrow(() -> ApiException.notFound("Jira project"));
                repo.projectByJira(jiraProjectId).filter(p -> !p.equals(projectId)).ifPresent(p -> {
                    throw ApiException.conflict("JIRA_PROJECT_TAKEN", "This Jira project is linked to another project");
                });
            }
            repo.setProjectLink(projectId, jiraProjectId,
                    issueType == null || issueType.isBlank() ? null : issueType.trim());
        });
    }

    // ============================== issue types ==============================

    /** Issue type names across the synced projects — for the default type picker in Administration → Jira. */
    public List<IssueTypeUsage> issueTypeUsage() {
        return tx.execute(s -> {
            Map<String, int[]> counts = new LinkedHashMap<>();
            Map<String, String> display = new LinkedHashMap<>();
            for (JiraProjectRow p : repo.projects("", "all")) {
                if (p.removedAt() != null) continue;
                for (IssueType t : types(p.issueTypes())) {
                    if (!JiraIssueTypes.standard(t)) continue;
                    String k = t.name().trim().toLowerCase(Locale.ROOT);
                    display.putIfAbsent(k, t.name().trim());
                    int[] c = counts.computeIfAbsent(k, x -> new int[2]);
                    c[1]++;
                    if (p.linkedProjectId() != null) c[0]++;
                }
            }
            return counts.entrySet().stream()
                    .map(e -> new IssueTypeUsage(display.get(e.getKey()), e.getValue()[0], e.getValue()[1]))
                    .sorted((a, b) -> a.linkedProjects() != b.linkedProjects()
                            ? Integer.compare(b.linkedProjects(), a.linkedProjects())
                            : Integer.compare(b.allProjects(), a.allProjects()))
                    .toList();
        });
    }

    /** Linked projects with the issue type each will use. */
    public List<LinkedProject> linkedProjects(String q) {
        return tx.execute(s -> {
            String deflt = repo.connection().map(Connection::defaultIssueType).orElse("Bug");
            return repo.projects(q, "linked").stream()
                    .map(p -> {
                        List<IssueType> types = types(p.issueTypes()).stream().filter(JiraIssueTypes::standard).toList();
                        return new LinkedProject(p.linkedProjectId(), p.linkedProjectKey(), p.linkedProjectName(), p.id(),
                                p.key(), p.linkedIssueType(), types,
                                JiraIssueTypes.pick(types, null, p.linkedIssueType(), deflt));
                    })
                    .toList();
        });
    }

    /** Bulk: one issue type (or null — back to the default) for the given linked projects, or for all of them. */
    public int setIssueTypes(List<UUID> projectIds, String issueType) {
        String t = issueType == null || issueType.isBlank() ? null : issueType.trim();
        return tx.execute(s -> repo.setIssueTypeForProjects(projectIds, t));
    }

    public ProjectJira projectJira(AuthUser me, UUID projectId) {
        return tx.execute(s -> {
            access.requireReadable(me, projectId);
            Optional<Connection> conn = repo.connection();
            String deflt = conn.map(Connection::defaultIssueType).orElse("Bug");
            Optional<ProjectLink> link = repo.link(projectId);
            if (link.isEmpty()) {
                return new ProjectJira(conn.isPresent(), null, null, null, null, deflt, List.of(), null);
            }
            ProjectLink l = link.get();
            List<IssueType> types = types(l.issueTypes()).stream().filter(JiraIssueTypes::standard).toList();
            String name = repo.project(l.jiraProjectId()).map(JiraProjectRow::name).orElse(null);
            return new ProjectJira(conn.isPresent(), l.jiraProjectId(), l.jiraProjectKey(), name, l.issueType(), deflt,
                    types, JiraIssueTypes.pick(types, null, l.issueType(), deflt));
        });
    }

    /** Issue types of one Jira project, fresh from Jira (service account), saved for later. */
    public List<IssueType> refreshIssueTypes(AuthUser me, String jiraProjectId) {
        if (!me.has(Permissions.INTEGRATION_MANAGE) && !me.has(Permissions.REPORT_SEND_TRACKER)) {
            throw ApiException.forbidden("No access to Jira settings");
        }
        Credentials c = serviceCredentials();
        tx.executeWithoutResult(s -> repo.project(jiraProjectId).orElseThrow(() -> ApiException.notFound("Jira project")));
        List<IssueType> types = client.issueTypes(c, jiraProjectId);
        tx.executeWithoutResult(s -> repo.setIssueTypes(jiraProjectId, typesJson(types)));
        return types.stream().filter(JiraIssueTypes::standard).toList();
    }

    String typesJson(List<IssueType> types) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (IssueType t : types) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.id());
            m.put("name", t.name());
            m.put("subtask", t.subtask());
            if (t.level() != null) m.put("level", t.level());
            out.add(m);
        }
        return json.writeValueAsString(out);
    }

    // ============================== issue status ==============================

    /** "Refresh" on the report page: re-reads the status of the report's Jira issues now. */
    public List<ExternalLink> refreshStatus(AuthUser me, UUID reportId) {
        List<ExternalLink> current = links(me, reportId);
        Credentials c = serviceCredentials();
        for (ExternalLink l : current) {
            if (!"JIRA".equals(l.type())) continue;
            JiraClient.IssueStatus st;
            try {
                st = client.issueStatus(c, l.externalKey());
            } catch (JiraClient.BadCredentials e) {
                throw ApiException.badRequest("JIRA_BAD_CREDENTIALS", "Jira rejected the service account token");
            }
            tx.executeWithoutResult(s -> {
                if (st == null) repo.markMissing(l.externalKey());
                else repo.updateStatus(l.externalKey(), st.name(), st.category());
            });
        }
        return links(me, reportId);
    }

    // ============================== user: personal token ==============================

    public MyJira my(AuthUser me) {
        return tx.execute(s -> {
            Optional<Connection> c = repo.connection();
            Optional<UserToken> t = repo.token(me.id());
            return new MyJira(c.isPresent(), c.map(Connection::baseUrl).orElse(null), t.isPresent(),
                    t.map(x -> x.invalidAt() != null).orElse(false), t.map(UserToken::jiraEmail).orElse(null),
                    t.map(UserToken::displayName).orElse(null), t.map(UserToken::verifiedAt).orElse(null));
        });
    }

    public MyJira saveMyToken(AuthUser me, String email, String token) {
        Connection c = tx.execute(s -> repo.connection())
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "JIRA_NOT_CONFIGURED",
                        "Jira is not connected yet — ask an administrator"));
        String mail = required(email, "Enter your Atlassian e-mail");
        String tok = required(token, "Enter your API token");
        Myself who;
        try {
            who = client.myself(new Credentials(c.baseUrl(), mail, tok));
        } catch (JiraClient.BadCredentials e) {
            throw ApiException.badRequest("JIRA_BAD_CREDENTIALS", "Jira rejected the e-mail and API token");
        }
        tx.executeWithoutResult(s -> repo.saveToken(me.id(), mail.trim(), cipher.encrypt(tok.trim()), who.accountId(),
                who.displayName()));
        return my(me);
    }

    public void deleteMyToken(AuthUser me) {
        tx.executeWithoutResult(s -> repo.deleteToken(me.id()));
    }

    // ============================== sending a report ==============================

    public List<ExternalLink> links(AuthUser me, UUID reportId) {
        return tx.execute(s -> {
            ReportRepository.Header h = reports.header(reportId).orElseThrow(() -> ApiException.notFound("Report"));
            if (h.project() != null) access.requireReadable(me, h.project().id());
            return repo.links(reportId);
        });
    }

    /**
     * Creates a Jira issue from a report on behalf of the user.
     * 409 codes the site and the extension react to: JIRA_NOT_CONFIGURED, JIRA_PROJECT_NOT_LINKED,
     * JIRA_TOKEN_MISSING, JIRA_TOKEN_INVALID (→ "add / update your token in My profile").
     */
    public ExternalLink send(AuthUser me, UUID reportId, String requestedIssueType) {
        if (!me.has(Permissions.REPORT_SEND_TRACKER)) {
            throw ApiException.forbidden("Your role cannot send reports to Jira");
        }
        record Prepared(Connection conn, ProjectLink link, UserToken token, Map<String, String> fields,
                        List<String> errors, Optional<FileRow> image) {
        }
        Prepared p = tx.execute(s -> {
            ReportRepository.Header h = reports.header(reportId).orElseThrow(() -> ApiException.notFound("Report"));
            if (h.project() == null) {
                throw conflict("JIRA_PROJECT_NOT_LINKED", "The report has no project — choose a project first");
            }
            access.requireReadable(me, h.project().id());
            Connection conn = repo.connection()
                    .orElseThrow(() -> conflict("JIRA_NOT_CONFIGURED", "Jira is not connected yet — ask an administrator"));
            ProjectLink link = repo.link(h.project().id())
                    .orElseThrow(() -> conflict("JIRA_PROJECT_NOT_LINKED",
                            "Project " + h.project().key() + " is not linked to a Jira project — ask an administrator"));
            UserToken token = repo.token(me.id())
                    .orElseThrow(() -> conflict("JIRA_TOKEN_MISSING", "Add your Jira API token in My profile → Jira"));
            if (token.invalidAt() != null) {
                throw conflict("JIRA_TOKEN_INVALID", "Jira rejected your API token — enter a new one in My profile → Jira");
            }
            List<FileRow> f = files.listByEntities(List.of(reportId));
            Optional<FileRow> image = f.stream().filter(x -> x.kind() == Kind.SCREENSHOT).findFirst()
                    .or(() -> f.stream().filter(x -> x.kind() == Kind.THUMBNAIL).findFirst());
            return new Prepared(conn, link, token, repo.reportFields(reportId), repo.reportErrors(reportId, 10), image);
        });

        Credentials creds = new Credentials(p.conn().baseUrl(), p.token().jiraEmail(), cipher.decrypt(p.token().tokenEnc()));
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("project", Map.of("id", p.link().jiraProjectId()));
        fields.put("issuetype", issueType(p.link(), p.conn(), requestedIssueType));
        fields.put("summary", summary(p.fields()));
        fields.put("description", description(reportId, p.fields(), p.errors()));
        List<String> labels = new ArrayList<>(List.of("bugstream"));
        String env = p.fields().get("environment");
        if (env != null && !env.isBlank()) labels.add("env-" + env.toLowerCase(Locale.ROOT));
        fields.put("labels", labels);
        String severity = p.fields().get("severity");
        if (severity != null && PRIORITY.containsKey(severity)) {
            fields.put("priority", Map.of("name", PRIORITY.get(severity)));
        }
        if (p.conn().environmentField() != null && env != null) {
            fields.put(p.conn().environmentField(), adfText(env));
        }

        CreatedIssue issue;
        try {
            issue = client.createIssue(creds, fields, List.of("priority", String.valueOf(p.conn().environmentField())));
        } catch (JiraClient.BadCredentials e) {
            tx.executeWithoutResult(s -> repo.markTokenInvalid(me.id()));
            throw conflict("JIRA_TOKEN_INVALID", "Jira rejected your API token — enter a new one in My profile → Jira");
        }

        p.image().ifPresent(img -> {
            try {
                byte[] bytes = Files.readAllBytes(storage.resolve(img.storageKey()));
                client.attach(creds, issue.key(), img.fileName(), img.mimeType(), bytes);
            } catch (IOException | RuntimeException e) {
                log.warn("Could not attach the screenshot to {}: {}", issue.key(), e.getMessage());
            }
        });

        JiraClient.IssueStatus created = null;
        try {
            created = client.issueStatus(creds, issue.key());
        } catch (RuntimeException e) {
            // the background sync will pick it up
        }
        final JiraClient.IssueStatus st = created;
        return tx.execute(s -> {
            repo.insertLink(reportId, issue.key(), issue.url(), me.id());
            if (st != null) repo.updateStatus(issue.key(), st.name(), st.category());
            return repo.links(reportId).stream()
                    .filter(l -> issue.url().equals(l.externalUrl()))
                    .reduce((a, b) -> b)
                    .orElseThrow();
        });
    }

    // ------------------------------------------------------------------

    private Credentials serviceCredentials() {
        Connection c = tx.execute(s -> repo.connection())
                .orElseThrow(() -> conflict("JIRA_NOT_CONFIGURED", "Jira is not connected yet"));
        return new Credentials(c.baseUrl(), c.serviceEmail(), cipher.decrypt(c.serviceTokenEnc()));
    }

    private Map<String, Object> issueType(ProjectLink link, Connection conn, String requested) {
        JiraIssueTypes.Choice c = JiraIssueTypes.pick(types(link.issueTypes()), requested, link.issueType(),
                conn.defaultIssueType());
        return c.id() != null ? Map.of("id", c.id()) : Map.of("name", c.name());
    }

    List<IssueType> types(String jsonText) {
        List<IssueType> out = new ArrayList<>();
        try {
            for (JsonNode t : json.readTree(jsonText == null ? "[]" : jsonText)) {
                JsonNode lvl = t.path("level");
                out.add(new IssueType(t.path("id").asString(null), t.path("name").asString(null),
                        t.path("subtask").asBoolean(false), lvl.isNumber() ? lvl.asInt() : null));
            }
        } catch (RuntimeException e) {
            // broken JSON: treat as unknown
        }
        return out;
    }

    private static String summary(Map<String, String> f) {
        String t = f.getOrDefault("title", "Bug report").replace('\n', ' ');
        return t.length() > 250 ? t.substring(0, 250) + "…" : t;
    }

    /** Atlassian Document Format (Jira Cloud API v3 does not accept plain text descriptions). */
    private Map<String, Object> description(UUID reportId, Map<String, String> f, List<String> errors) {
        String link = props.publicUrl().replaceAll("/+$", "") + "/reports/" + reportId;
        List<Object> content = new ArrayList<>();
        String desc = f.get("description");
        if (desc != null && !desc.isBlank()) {
            for (String para : desc.split("\\n\\s*\\n")) {
                content.add(paragraph(List.of(text(para))));
            }
        }
        content.add(paragraph(List.of(
                text("Bug Stream report (video, console, network, actions): "),
                Map.of("type", "text", "text", link, "marks", List.of(Map.of("type", "link", "attrs", Map.of("href", link)))))));
        List<Object> rows = new ArrayList<>();
        row(rows, "Environment", f.get("environment"));
        row(rows, "Page", f.get("page_url"));
        row(rows, "Browser", join(f.get("browser"), f.get("browser_version")));
        row(rows, "OS", join(f.get("os"), f.get("os_version")));
        row(rows, "Window", f.get("window_size"));
        row(rows, "Severity", f.get("severity"));
        if (!rows.isEmpty()) {
            content.add(Map.of("type", "bulletList", "content", rows));
        }
        if (!errors.isEmpty()) {
            content.add(Map.of("type", "heading", "attrs", Map.of("level", 4), "content", List.of(text("Errors"))));
            StringBuilder sb = new StringBuilder();
            for (String e : errors) {
                sb.append(e.length() > 300 ? e.substring(0, 300) + "…" : e).append('\n');
            }
            content.add(Map.of("type", "codeBlock", "content", List.of(text(sb.toString().trim()))));
        }
        return Map.of("type", "doc", "version", 1, "content", content);
    }

    private static Map<String, Object> adfText(String s) {
        return Map.of("type", "doc", "version", 1, "content", List.of(paragraph(List.of(text(s)))));
    }

    private static Map<String, Object> paragraph(List<Object> nodes) {
        return Map.of("type", "paragraph", "content", nodes);
    }

    private static Map<String, Object> text(String s) {
        return Map.of("type", "text", "text", s.isEmpty() ? " " : s);
    }

    private static void row(List<Object> rows, String label, String value) {
        if (value == null || value.isBlank()) return;
        rows.add(Map.of("type", "listItem", "content", List.of(paragraph(List.of(
                Map.of("type", "text", "text", label + ": ", "marks", List.of(Map.of("type", "strong"))),
                text(value))))));
    }

    private static String join(String a, String b) {
        if (a == null) return b;
        return b == null ? a : a + " " + b;
    }

    /** Jira key → Bug Stream key (^[A-Z][A-Z0-9_]{1,19}$). */
    static String bugStreamKey(String jiraKey) {
        String k = jiraKey.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_]", "_");
        if (k.isEmpty() || !Character.isLetter(k.charAt(0))) k = "J" + k;
        if (k.length() < 2) k = k + "_";
        return k.length() > 20 ? k.substring(0, 20) : k;
    }

    private static String required(String v, String message) {
        if (v == null || v.isBlank()) throw ApiException.badRequest("VALIDATION", message);
        return v;
    }

    private static ApiException conflict(String code, String message) {
        return new ApiException(HttpStatus.CONFLICT, code, message);
    }
}
