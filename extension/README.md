# Bug Stream — Chrome extension for the development team

Records a bug on any internal site: tab video, console, network requests (with headers and bodies),
user actions and browser info — and sends it as one report to your organization's server
(`../server`, your subdomain). A Jira Cloud issue with the chosen environment can be created right from the report form.

How it differs from the widget (`../widget`): the widget is embedded into one site's code and works for all its
users; the extension is installed in the Chrome of developers and testers and works on any site,
without changing its code.

Security review — [SECURITY.md](SECURITY.md). Rolling out to employees — [docs/deploy.md](docs/deploy.md).

## How to use

1. Bug Stream icon on the Chrome toolbar → sign in (the server address is preset; use your work login / e-mail and password —
   the same as on the site; with Active Directory, your domain password).
2. **Record tab** (`Alt+Shift+R`) → reproduce the bug → **Stop**.
   Or **Screenshot**, or **Last 2 min** (`Alt+Shift+Y`, turned on in the settings).
   On macOS the keys are `⌥⇧R` and `⌥⇧Y` (Option+Shift); any of them can be changed in `chrome://extensions/shortcuts`,
   and the popup always shows the keys currently in use.
3. The preview opens: video, event track, console and network. Fill in the form:

| Field | How it is filled |
|---|---|
| Title, description | manually; the hint is the first console or network error |
| Project, service | automatically, by the page address (URL patterns of the project on the site); with many projects a search box finds them by name, key or Jira key / ID |
| **Environment** | list from **Administration → Environments**; taken from the service, can be changed |
| Severity, tags | manually |
| **Create an issue in Jira** | shown when the project is linked to a Jira project and your role may send to Jira. Remembered per project |

4. **Save report** → the report is on the server; with the checkbox — a Jira issue right away, its link appears
   in the "Report saved" panel. If your personal Jira token is missing or expired, the form says so in advance with a link
   to **My profile → Jira**; the report is saved anyway and can be sent to Jira from its page later.

### What goes into Jira
- Title → Summary; issue type — from the project's Jira settings (Bug by default).
- Description: text from the form, link to the report (video, console, network, actions), **environment**, page,
  browser, OS, window size, severity, the first console and network errors.
- Labels: `bugstream` + `env-dev` / `env-test` / `env-stage` / `env-prod` (or your environment code).
- Severity → priority when the Jira screen allows it; the screenshot is attached.
- The issue is created under your own Atlassian account (personal API token in **My profile**).

### Recording settings (in the popup)
| Setting | Default | What it does |
|---|---|---|
| Maximum video length | 10 minutes | 5 / 10 / 20 / 30 minutes. Pauses do not count |
| Pause when nothing happens | on, 1 minute | no mouse movement or key presses — recording pauses and resumes by itself |
| Instant replay | off | keeps a ~2 minute recording of the page in memory; sends nothing until you save |
| Language | from your profile | English, Русский, Azərbaycanca — also saved to your profile on the site |

The video is written to disk in 2-second chunks (the extension's IndexedDB) — up to 30 minutes (≈ 11 MB per minute).
If the browser crashed during recording, the recording appears in the popup under "Unsaved recordings"; they are deleted after 3 days.

## Installation

**For the whole team** — by group policy from your server, installs and updates itself: [docs/deploy.md](docs/deploy.md).

**To try it on one computer** (no build):
1. `chrome://extensions` → **Developer mode** → **Load unpacked** → the `extension/dist` folder.
2. Pin the icon (puzzle → pin), sign in. The prebuilt `dist` defaults to `http://localhost`;
   enter your subdomain when signing in or rebuild (below).

### macOS
The extension is the same on every system. It records only the Chrome tab (not the screen), so macOS does not ask for
the "Screen Recording" permission. Recording started from a button on the site shows Chrome's "Share a tab" picker —
choose the current tab. Rollout to managed Macs — [docs/deploy.md](docs/deploy.md#macos).

## Build

Requires Node.js 22+. Dependencies can come from Nexus — copy `.npmrc.example` to `.npmrc`.

```bash
npm ci
BUGSTREAM_SERVER=https://bugs.example.com npm run build      # → dist/, the address is preset
```
In PowerShell: `$env:BUGSTREAM_SERVER="https://bugs.example.com"; npm run build`.

The group policy build (build + `.crx` + `update.xml`) is one command, `scripts\pack-extension.ps1` — see `docs/deploy.md`.
On macOS / Linux it runs with PowerShell 7 (`pwsh scripts/pack-extension.ps1`) or pack by hand — see `docs/deploy.md`.

## Sources

```
src/
  background.ts       service worker: start/stop recording, screenshot, link with the page
  offscreen.ts        video recording (MediaRecorder) into IndexedDB
  popup.ts            the toolbar popup: sign-in, buttons, settings, language
  preview.ts          preview and report form, upload to the server, Jira issue
  content/
    main-world.ts     console / fetch / XHR hooks in the page
    isolated.ts       user actions, event buffer, recording bar
    replay.ts         "last 2 minutes" (rrweb), memory only
  shared/             settings, server API, i18n (i18n.ts + i18n-dict.ts), types
  core/               code shared with the widget (hooks, actions, IndexedDB, rrweb)
static/               manifest.json, _locales (store texts), schema.json (policy), pages, styles, icons, fonts
scripts/pack-extension.ps1   build and pack for GPO
```

### Translations
Texts are written in English in the code (`t("Save report")`, `data-i18n` in the HTML pages); Russian and
Azerbaijani are in `src/shared/i18n-dict.ts`, keyed by the English text. The manifest texts are in `static/_locales/*/messages.json`.
Data that goes into reports (event names such as "Paused", "Recording started on …") is always English.
