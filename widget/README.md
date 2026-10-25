# Bug Stream — widget

A single file, `dist/bug-stream.js` (~125 KB). A site includes it and its users get
"Report a bug": tab video, a screenshot or the last 2 minutes of the page — together with the console,
network requests and actions. The report goes **only to the organization's server** (the `../server` folder).
No browser extension is needed.

Security review — [SECURITY.md](SECURITY.md).

## Adding it to a site

The key is created on the server: project → **Widget** tab → **Create key** (the ready snippet is there too).

```html
<script src="https://bugs.example.com/widget/bug-stream.js"
        integrity="sha384-…from dist/bug-stream.js.sha384…" crossorigin="anonymous"></script>
<script>
  bugstream.init({
    server: "https://bugs.example.com",
    key: "adk_…",
    user: { id: currentUser.id, email: currentUser.email, name: currentUser.name },
    lang: "en",                                   // en | ru | az
    redactHeaders: ["authorization", "cookie", "set-cookie"],
  });
</script>

<!-- your own button in the site menu (show it according to the user's rights) -->
<button onclick="bugstream.report()">Report a bug</button>
```

`integrity` is optional, but with it the browser refuses to run the file if it was replaced on the server.
The value changes after every build — take it from `dist/bug-stream.js.sha384`.

React / Next.js — the same: load the script once after the user signs in and call `bugstream.init(...)`;
the button calls `window.bugstream.report()`.

## `bugstream.init` options

| Option | What it does |
|---|---|
| `server` | server address (subdomain), required |
| `key` | project widget key, required |
| `user` | `{ id, email, name }` — if the e-mail matches a server user, they become the author |
| `context` | any application data (role, organization, version) — goes into the Info tab |
| `lang` | `en`, `ru`, `az` (default — browser language if it is Russian or Azerbaijani, otherwise English) |
| `brand` | `{ name, color }` — name and color in the widget window |
| `features` | `{ video, screenshot, replay }` — which menu items to show (all by default) |
| `button` | `true` — a floating button in the corner (off by default, the site provides the button) |
| `maxMinutes` | maximum video length (default 10) |
| `redactHeaders` | network headers whose values are replaced with `[hidden]` before sending |

Methods: `bugstream.report()`, `bugstream.setUser(...)`, `bugstream.setContext(...)`, `bugstream.log(...)`.
Window events: `bugstream:ready`, `bugstream:state`.

The environment of a widget report (DEV / TEST / …) is resolved by the server from the page address
(project service URL patterns).

## Build

Requires Node.js 22+. Dependencies can come from Nexus — copy `.npmrc.example` to `.npmrc`.

```bash
npm ci
npm run build
```

Output:
- `dist/bug-stream.js` — the widget itself;
- `dist/bug-stream.js.map` — source map (for review, not deployed to the server);
- `dist/bug-stream.js.sha384` — checksum for `integrity`.

If `../server` exists next to it, the build copies the file into `server/frontend/public/widget/`,
and the server serves it at `https://<subdomain>/widget/bug-stream.js`.

## Sources

```
src/
  index.ts          start, menu, video recording, form, upload
  ui.ts             widget window (Shadow DOM, isolated from the site's styles)
  i18n.ts           texts en / ru / az
  core/
    page-hooks.ts   console, error, fetch, XMLHttpRequest hooks
    page-actions.ts clicks, input, navigation; page and browser info
    replay-buffer.ts last 2 minutes of the page (rrweb), memory only
    db.ts           video chunks in the browser's IndexedDB while recording
    filter.ts       network address filter
    types.ts        event types
```

License — Apache-2.0 (`LICENSE`).
