# Bug Stream extension — description for the information security review

Version 0.4.0, Manifest V3. Build — `dist/`, sources — `src/`, `static/` (the code is not minified and is reviewed as is).
Purpose: developers and testers record a bug on an internal site and send a report to the
**organization's internal server** (`../server`, subdomain), from which a Jira issue can be created.

## 1. Where data goes
Only to the server address set at build time (`BUGSTREAM_SERVER`), by policy (`server`) or by the user at sign-in.
There are no other addresses: no analytics, no CDN, no updates from third-party servers (fonts and libraries are bundled).
`dist/*.js` contains only SVG/XHTML namespace URIs and links in library comments — these are not requests.
The extension does **not** talk to Jira directly: the server creates the issue with the user's personal Jira token stored on the server.

| Request to the server | When | What is sent |
|---|---|---|
| `POST /api/auth/login`, `/refresh`, `/logout` | sign-in, token refresh, sign-out | login and password (password sign-in only), refresh token |
| `GET /api/auth/config` | the sign-in form is shown | — (which sign-in methods the server offers) |
| `POST /api/auth/email-code`, `/email-code/verify` | sign-in with an e-mail code | e-mail address, then the 6-digit code |
| `PUT /api/auth/me/locale` | the user changes the language in the popup | `en` / `ru` / `az` |
| `GET /api/projects/resolve?url=…` | top-level page load (for the site button `window.adtask`; the answer is cached for 10 minutes per site), recording start, screenshot | **full page address** — to determine the project and service |
| `GET /api/projects`, `/api/projects/{id}`, `/api/environments`, `/api/me/jira` | the report form is open | — |
| `POST /api/reports` | the user pressed "Save report" | the report (see section 2) |
| `POST /api/reports/{id}/jira` | after saving, if "Create an issue in Jira" is ticked | — |

Until the user signs in, the extension makes no requests other than sign-in.
Page addresses (the `resolve` call) go to the server while the user is signed in. To limit the sites the extension
works on at all, use the `runtime_allowed_hosts` policy (see `docs/deploy.md`, section 4): outside the list the extension
does not see pages and does not send their addresses.

## 2. What is recorded
Extension scripts run on `http`/`https` pages (in all frames) from page load and keep events
**in the tab's memory** — the last 5 minutes. They reach the server only inside a report, on "Save".

| Data | Details |
|---|---|
| Console | `console.*`, unhandled errors, promise rejections, resource load errors |
| Network | page `fetch` and `XMLHttpRequest`: method, address, status, timing, **request and response headers and bodies** (up to 256 KB) |
| Actions | clicks, input (value up to 500 characters), select changes, form submits, navigation |
| Info | page address and title, browser, OS, window and screen size, language, time zone, network type |
| Video | only on "Record tab": video of the **current tab** (`tabCapture`), no audio |
| Screenshot | on the button: the visible part of the current tab |
| Last 2 minutes | only if the user turned on Instant replay: a DOM snapshot of the page and its changes (rrweb), in memory |

**Hidden:** values of `type="password"` fields (dots in actions, masked in replay).
**Not hidden:** request and response bodies, headers (including `Authorization`, `Cookie` if the page sends them
from JavaScript), values typed into other fields, page content — a deliberate decision so that the report is complete.
Requests to selected addresses can be excluded on the server: project → "Network filter". Administrators can also hide
network bodies on public share pages (**Administration → Settings**).
Reports are visible to signed-in server users according to their role (private projects — members only), and to holders of
a public share link if a user created one (default lifetime 30 days, revocable, every view logged).

## 3. Permissions (manifest.json)

| Permission | Why |
|---|---|
| `tabCapture` | video of the current tab on "Record tab" |
| `offscreen` | MediaRecorder is not available in a service worker — a hidden offscreen document of the extension records the video |
| `activeTab` | record and screenshot only the tab where the user clicked the icon or pressed the shortcut |
| `scripting` | inject the recording scripts into tabs opened before installation; collect the event buffer for a screenshot |
| `storage` | server address, sign-in tokens, recording settings, language, last Jira choice per project |
| `unlimitedStorage` | the video is written to IndexedDB in 2-second chunks (up to 30 minutes, ≈ 11 MB/min) instead of being kept in memory |
| `host_permissions: <all_urls>` | bugs happen on any internal site — the recording scripts must run on the page the person works on. Narrowed by the `runtime_allowed_hosts` policy |

Not requested: `cookies`, `history`, `webRequest`, `downloads`, `tabs`, `nativeMessaging`, `clipboardRead`.

## 4. What is stored on the computer

| Where | What | How long |
|---|---|---|
| `chrome.storage.local` | server address, access and refresh tokens, user name, e-mail, role permissions, settings, language, Jira choice per project | until sign-out |
| `chrome.storage.session` | recording state, "site is linked to a project" cache | until the browser closes |
| Extension IndexedDB | video chunks and events of the current recording | deleted after sending or deleting; unsaved ones after 3 days |

Tokens: access — 15 minutes, refresh — 30 days (server settings `app.jwt`). Sign-out in the popup deletes them and revokes the refresh token on the server.
No Jira or Slack credentials are ever stored in the extension.

## 5. Code
- No remote code (an MV3 requirement): everything is bundled, `eval` / `new Function` / `importScripts` are not used.
- The page script (`content-main.js`) wraps `console.*`, `fetch`, `XMLHttpRequest` — it calls the original and
  copies the data; site behavior does not change. Data goes to the isolated extension script via
  `window.postMessage` of the same window; the receiver accepts only messages from its own window (`e.source === window`).
  The page's own scripts can see these messages — they contain only data of this same page.
- The site button (`window.adtask`) appears only on sites linked to projects on the server.
- UI translations are static strings bundled into the extension (`src/shared/i18n-dict.ts`); HTML translations
  (`data-i18n-html`) come only from that bundled dictionary, never from the server or the page.

## 6. Dependencies (inside `dist`)

| Package | Version | License |
|---|---|---|
| @rrweb/record, @rrweb/types | 2.1.5 | MIT |
| rrweb-player | 2.1.5 | MIT |
| rrweb, rrweb-snapshot, rrdom, @rrweb/replay, @rrweb/packer, @rrweb/utils | 2.1.7 | MIT |
| @xstate/fsm 1.6.5, base64-arraybuffer 1.0.2, mitt 3.0.1, fflate 0.4.9, postcss 8.5.30, nanoid 3.3.20 | | MIT |
| picocolors 1.1.1 | | ISC |
| source-map-js 1.2.2 | | BSD-3-Clause |
| Golos Text, JetBrains Mono fonts (`static/fonts`) | | SIL OFL 1.1 |

Build tools (not in `dist`): esbuild 0.28.2, typescript 5.9.3, @types/chrome.
Exact versions and hashes — `package-lock.json`.

## 7. Reproducible build
```bash
npm ci
BUGSTREAM_SERVER=https://bugs.example.com npm run build
```
`dist/` can be compared with the installed extension (`chrome://extensions` → ID → profile folder `Extensions/<ID>/<version>`).
