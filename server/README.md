# Bug Stream — server

Java 25 + Spring Boot 4.1, PostgreSQL 18 (Flyway migrations on start), React 19 site, nginx.
Runs with Docker Compose. Only nginx is exposed (ports 80/443); the database and the backend stay inside the Docker network.

```
server/
  docker-compose.yml
  .env.example          all settings
  backend/              Java (Spring Boot), migrations in src/main/resources/db/migration
  frontend/             site (React) + nginx; frontend/public/widget/bug-stream.js — the widget
    nginx/              configuration: http (behind a load balancer) and https (own certificate)
  certs/                subdomain certificate (for TLS_MODE=nginx)
    ca/                 internal CA certificates trusted by the backend (LDAPS, TLS-inspecting proxy)
  extension-dist/       adtask.crx + update.xml for installing the extension (built by ../extension/scripts/pack-extension.ps1)
  storage/              report videos and screenshots
  docs/
    nexus.md            building through Nexus
    api/ingest.openapi.yaml   report intake API used by the widget
```

## 1. Requirements
- Linux server with Docker 24+ and Docker Compose v2; 2 CPU, 4 GB RAM; disk for videos (≈ 12 MB per minute of recording).
- A subdomain pointing to the server (or to the load balancer in front of it), e.g. `bugs.example.com`.
- A certificate for the subdomain — on the load balancer or in the `certs/` folder.
- Access to Docker Hub, Maven Central and npm — directly or through Nexus (`docs/nexus.md`).
- Outgoing HTTPS to `*.atlassian.net` (Jira Cloud) and `slack.com` if you use them — directly or through a proxy (`JAVA_OPTS`).

## 2. Configuration
```bash
./scripts/init-env.sh bugs.example.com        # Linux / macOS
```
```powershell
powershell -ExecutionPolicy Bypass -File scripts\init-env.ps1 -Domain bugs.example.com   # Windows
```
The script copies `.env.example` to `.env` and fills in random `POSTGRES_PASSWORD`, `JWT_SECRET` and `ADMIN_PASSWORD`
(it prints the administrator password). With `localhost` it also sets `http://` addresses for a local try.
You can also copy `.env.example` by hand — but the server refuses to start on a real address while the
`change_me…` placeholders are still there.

Required:

| Variable | What |
|---|---|
| `APP_DOMAIN` | subdomain without `https://`, e.g. `bugs.example.com` |
| `TLS_MODE` | `proxy` — HTTPS on the load balancer; `nginx` — certificate in `certs/` |
| `POSTGRES_PASSWORD` | `openssl rand -base64 24` |
| `JWT_SECRET` | at least 32 characters: `openssl rand -base64 48` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | first administrator (local account, created while there are no users) |

Optional:

| Variable | What |
|---|---|
| `INTEGRATION_SECRET` | key that encrypts Jira and Slack tokens (empty = `JWT_SECRET`). Never change it afterwards |
| `JAVA_OPTS` | e.g. an outgoing proxy: `-Dhttps.proxyHost=proxy.example.com -Dhttps.proxyPort=3128` |
| `LDAP_*` | Active Directory sign-in — optional starting values; usually set in Administration → Sign-in methods (see 4c) |
| `SMTP_*` | mail server — optional starting values; usually set in Administration → E-mail (SMTP) |

`APP_DOMAIN` gives the address used in e-mails, Jira issues and share links (`https://<domain>`), the allowed API
origin and the nginx server name. The site shows the widget snippet with the address it was opened at — so
open it by the subdomain, not by IP.

### HTTPS
**`TLS_MODE=proxy`** (typical in organizations): the load balancer (F5, HAProxy, corporate nginx) accepts
`https://<domain>` and forwards to `http://<server>:HTTP_PORT`. It must pass `X-Forwarded-Proto: https`,
allow request bodies up to 1.1 GB (video) and response times up to 300 s.

**`TLS_MODE=nginx`**: put `fullchain.pem` and `privkey.pem` into `certs/` (names — `TLS_CERT`, `TLS_KEY`).
Port 80 redirects to 443. TLS 1.2/1.3, HSTS.

## 3. Start
```bash
docker compose up -d --build
docker compose logs -f backend     # wait for "Started ..."
```
Open `https://<domain>`, sign in as administrator, **change the password**.

## 4. Administration
Everything below is in **Administration** (left menu), visible only to roles with the *admin.access* permission.

### 4a. Users, roles and permissions
- **Roles & permissions** — five built-in roles (Administrator, Developer, QA engineer, Analyst, Viewer) and your own;
  each role is a set of permissions (create projects, edit any report, delete reports, share, send to Jira, admin sections…).
  The Administrator role always keeps every permission.
- **Users** — create local accounts, add AD users in advance, change roles, disable accounts, reset local passwords.

### 4b. Environments
DEV / TEST / STAGE / PROD are created on first start; add your own (e.g. UAT), rename, recolor or hide them.
An environment that is used by reports or services can only be hidden, not deleted. The environment of a report
comes from the project service (a service has an environment and URL patterns, e.g. `test-crm.example.com` → TEST);
it can be changed in the extension and on the report page.

### 4c. Sign-in methods
**Administration → Sign-in methods** — each method is switched on separately; the sign-in page and the extension
show only the methods that are on. The code is built as pluggable providers, so single sign-on (OIDC: Keycloak,
Azure AD / Entra ID) can be added later as one more method.

| Method | Needs | Notes |
|---|---|---|
| **Password** | — | local accounts. Administrators (roles with *admin.access*) can always sign in with their local password, even when the method is off — the instance cannot be locked out |
| **"Forgot password?"** | Password + SMTP | e-mailed link, valid 1 hour |
| **Active Directory / LDAP** | a directory | domain login (`sAMAccountName`), UPN or e-mail; the account is created on the first sign-in |
| **One-time code by e-mail** | SMTP | 6 digits, 10 minutes, 5 attempts. Optional: allowed domains, create accounts on the first sign-in with a chosen role |

At least one method must stay available. Answers never reveal whether an address is registered; limits: 3 e-mails per
address per 15 minutes, 30 per IP per hour. Codes and links are stored only as HMACs.

**Invitations:** Administration → Users → New user → "Send an invitation e-mail" — the person sets their own password
from the link (valid 7 days); the link can be re-sent from the user's card.

**AD / LDAP connection** is set on the same page (server, base DN, service account, roles from AD groups, advanced
filter and attributes) with **Test connection**, which checks the form values before saving. Until it is saved there,
`LDAP_*` from `.env` are used. With a group mapping the role follows AD groups on every sign-in and people outside
these groups cannot sign in; without it new users get the default role and roles are managed in Users.
Put the internal CA certificate into `certs/ca/`.

### 4c-2. E-mail (SMTP)
**Administration → E-mail (SMTP)** — your own mail server: host, port, encryption (STARTTLS / SSL / none), login,
password (stored encrypted, never shown again), sender. **Send test e-mail** shows the SMTP server's answer.
Until it is saved there, `SMTP_*` from `.env` are used. It sends sign-in codes, reset and invitation links, and notifications.

### 4d. Jira Cloud
1. **Administration → Jira:** site address (`https://company.atlassian.net`) and a service account e-mail + API token
   (used only to read the project list), **Sync** → tick the projects to connect.
2. **Issue types** are loaded from Jira with the projects (also per project with **Refresh**). Set one **default issue
   type** in Administration → Jira; a project needs its own type only when it should differ. If a project does not have the
   chosen / default type, its bug type is used (Bug, Ошибка, Баг, Defect…), otherwise its first standard type — sending
   never fails because of a wrong type name. **Issue types of linked projects** shows what every project will use and
   changes many projects at once.
3. **Project → Jira & Slack:** the Jira project (searchable) and, if needed, its own issue type.
4. **Every user — My profile → Jira:** their own API token (https://id.atlassian.com/manage-profile/security/api-tokens).
   Issues are created on behalf of that user. If the token is missing or has expired, the site and the extension show a
   notice with a link to the profile.

Issues get a description with links to the report, the environment as a label (`env-prod`), the severity as priority
(when the Jira screen allows it) and the screenshot as an attachment. Tokens are stored encrypted (AES-GCM).

**Issue status.** A background job (every 5 minutes, `JIRA_STATUS_SYNC=PT5M` in `.env` to change) asks Jira with the
service account for issues with the label `bugstream` changed since the last run and stores their status. The reports
list shows it in its own column (To Do / In Progress / Done colors) and can be filtered by it; the report page has a
↻ button to check right away. The service account must be able to browse the linked projects.

### 4e. Slack
**Administration → Slack:** bot token (`xoxb-…`, scopes `chat:write`, `users:read`, `users:read.email`) → **Test**.
Then **Project → Jira & Slack → channel** — new reports and status changes are posted there (the bot must be invited to the channel).
Users can turn on Slack direct messages in **My profile** (matched by e-mail).

### 4f. Sharing
**Administration → Settings:** public share links on/off, default lifetime (30 days) and maximum (90 days),
whether network request/response bodies are visible on shared pages. A report link opened without signing in shows
the video, console, network and info read-only; links can be revoked on the report page or in the active links list.
Every view is logged.

### 4g. Audit log
**Administration → Audit log** — every change of users, roles, environments, settings, projects and reports (secrets are never logged).

## 5. Connecting the widget to a site
1. Create a project → **Widget** tab → **Create key**.
2. Enter the site addresses reports are accepted from (`https://crm.example.com`; `https://*.example.com` also works).
3. Copy the ready snippet into the site — details in `../widget/README.md`.

The key is visible in the site's code — that is fine: it only allows sending a report into this project
(the site address and a limit of 60 reports per hour are checked; the key can be disabled).

## 6. Extension
`https://<domain>/extension/update.xml` and `.../adtask.crx` are served from the `extension-dist` folder —
`../extension/scripts/pack-extension.ps1` puts them there. Policy installation — `../extension/docs/deploy.md`.

## 7. Updating
```bash
git pull
docker compose up -d --build
```
Database migrations run by themselves. A new widget version — after `npm run build` in `../widget`
(or the one already built in the repository) — reaches the site when `frontend` is rebuilt.

## 8. Backups
- Database: `docker compose exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > backup.sql.gz`
- Files: the `STORAGE_DIR` folder (default `./storage`).
- `.env` (especially `INTEGRATION_SECRET` / `JWT_SECRET`) — without it saved Jira and Slack tokens cannot be decrypted.

## 9. Ports
| Port | Who | Exposed |
|---|---|---|
| 80 / 443 | nginx: site, `/api`, `/widget`, `/extension` | yes (`HTTP_PORT`, `HTTPS_PORT`) |
| 8080 | backend | no, nginx only |
| 5432 | PostgreSQL | no |
