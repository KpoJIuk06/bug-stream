# Bug Stream widget — description for the information security review

Version 0.2.0. File: `dist/bug-stream.js`, checksum — `dist/bug-stream.js.sha384`.
Sources — `src/`, source map — `dist/bug-stream.js.map` (used to match the minified file against `src/`).

## 1. What it is
A JavaScript file that an organization's site includes with a `<script>` tag. With the "Report a bug" button
the user records a problem and sends a report to the **organization's internal server**
(`../server`: Java + PostgreSQL in Docker on a dedicated subdomain).

## 2. Where data goes
- **Only to the address from `bugstream.init({ server })`** — the internal subdomain:
  - `GET  {server}/api/ingest/config` — project name and network filter (no personal data);
  - `POST {server}/api/ingest/reports` — the report itself, **only when the user presses "Send"**.
- No third-party addresses: no analytics, CDN, fonts, telemetry or updates from external servers.
  Check: `grep -o "https\?://[^\"' )]*" dist/bug-stream.js` — the built file contains no addresses.
- Upload authorization — the widget key in the `X-Bug-Stream-Key` header. The key is public (visible in the page code)
  and grants **only** the right to send a report into one project. On the server: the SHA-256 of the key is stored, plus the list
  of allowed sites (`Origin` check), a limit of 60 reports per hour per key; the key can be disabled or deleted.
  Reports cannot be read with the key.
- Cookies and `credentials` are not used (requests carry no user credentials).

## 3. What is recorded
While the page is open, the widget keeps in browser memory (sending nothing):

| Data | Details | Where it is kept until sending |
|---|---|---|
| Console | `console.*`, unhandled errors and promise rejections, resource load errors | memory, last 5 minutes / 1500 events |
| Network | `fetch` and `XMLHttpRequest` of this page: method, address, status, timing, **request and response headers and bodies** (up to 256 KB per body) | same |
| Actions | clicks, field input (value up to 500 characters), navigation | same |
| Last 2 minutes | DOM snapshot of the page and its changes (rrweb), not video | memory, ~3 minutes, unless `features.replay` is off |
| Info | address, browser, OS, screen size, language, time zone, network type | read when the form opens |

Additionally, on a user action:
- **Video** — only the site's tab, through the standard browser request `getDisplayMedia` (the browser itself shows
  the picker and the recording indicator; recording is impossible without the user's consent). No audio. Chunks are written to
  this site's IndexedDB so that the recording survives a page reload; they are deleted after sending or cancelling,
  unfinished and unsent ones — on the next visit to the site if older than 3 days.
- **Screenshot** — a frame of the same `getDisplayMedia` stream.

Before sending, the user sees a form with the number of errors, requests and actions and can cancel.

## 4. Data hiding
- `type="password"` fields: dots instead of the value in actions (number of dots = length, max 12),
  rrweb mask in "last 2 minutes".
- `redactHeaders: ["authorization", "cookie", "set-cookie", "x-api-key"]` in `bugstream.init` — values of these
  headers are replaced with `[hidden]` before sending. **Off by default.** Recommended to turn on.
- Network filter on the server (project → "Network filter"): requests to selected addresses do not get into the report.
- Request and response bodies, input values and page content are **not masked** — a deliberate decision
  so that the report is complete. This is the main point to assess: the report may contain everything the user saw and
  typed on the page and everything the page received over the network. Reports are visible to server users according
  to their role (private projects — members only) and, if a user created a public share link, to anyone with that link
  (default 30 days, revocable, every view logged; administrators can hide network bodies on shared pages or turn sharing off).

## 5. How it embeds into the page
- Wraps `console.*`, `window.fetch`, `XMLHttpRequest.prototype.open/send/setRequestHeader` —
  the wrappers call the original and copy the data; the site's requests behave the same.
  The widget's own requests to the report server are not recorded.
- The UI lives in the Shadow DOM of a `<bug-stream>` element; the site's styles are not affected.
- Globals: `window.bugstream` and `window.adtask` (the same object, for compatibility), `Object.freeze`.
- No `eval`, `new Function`, loading of other scripts, `localStorage`/`sessionStorage`, `document.cookie`,
  `sendBeacon`, `WebSocket`.
- The built file contains rrweb code with `new Worker` (`<canvas>` recording) and `window.parent.postMessage`
  (recording of foreign iframes). Both rrweb features are **off** (`recordCanvas` and `recordCrossOriginIframes` are never enabled)
  and are not executed.
- `URL.createObjectURL` — only to show the user's own video and screenshot in the form before sending.
- `innerHTML` is used only for the widget window markup; all data is inserted escaped (`esc`).

### The site's Content-Security-Policy
If the site has a CSP, allow:
```
script-src  https://<subdomain>         (or 'sha384-…' from dist/bug-stream.js.sha384)
connect-src https://<subdomain>
```
The widget's styles live inside the Shadow DOM (a `<style>` in the shadow root is subject to CSP; with a strict `style-src`
add `'unsafe-inline'` or check how the window looks).

## 6. Dependencies
One library is bundled into the file — **@rrweb/record 2.1.5** (MIT) with its dependencies:

| Package | Version | License |
|---|---|---|
| @rrweb/record | 2.1.5 | MIT |
| rrweb, rrweb-snapshot, rrdom, @rrweb/types, @rrweb/utils | 2.1.7 | MIT |
| @xstate/fsm | 1.6.5 | MIT |
| base64-arraybuffer | 1.0.2 | MIT |
| mitt | 3.0.1 | MIT |
| postcss | 8.5.30 | MIT |
| nanoid | 3.3.20 | MIT |
| picocolors | 1.1.1 | ISC |
| source-map-js | 1.2.2 | BSD-3-Clause |

Build tools (not in the file): esbuild 0.28.2, typescript 5.9.3.
Exact versions and hashes — `package-lock.json`. Vulnerability check: `npm audit --omit=dev`
(through Nexus if it proxies audit) or the Nexus IQ / OWASP Dependency-Check scanner.

## 7. Reproducible build
```bash
npm ci && npm run build
cat dist/bug-stream.js.sha384      # must match the file on the server
curl -s https://<subdomain>/widget/bug-stream.js | openssl dgst -sha384 -binary | openssl base64 -A
```

## 8. Browser requirements
Chrome / Edge 110+, Firefox 115+, Safari 16+. Video and screenshot — only on HTTPS sites (a `getDisplayMedia` requirement).
