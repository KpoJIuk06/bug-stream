# Rolling out the Bug Stream extension to employees

| Path | When it fits | Google review | Updates |
|---|---|---|---|
| **1. Group policy + your own server** (recommended) | Windows computers joined to an Active Directory domain | No | Automatic, from your subdomain |
| **2. Chrome Web Store, "domain only"** | The company uses Google Workspace and employees sign in to Chrome with a corporate account | Yes | Automatic, through the store |
| **3. macOS: MDM profile + your own server** | Macs managed by Jamf, Kandji, Intune or another MDM | No | Automatic, from your subdomain |

For a few people during testing — "Load unpacked" (`../README.md`).

Chrome installs extensions from outside the store **only on domain-joined computers** (or ones managed
through Chrome Browser Cloud Management). For the others — path 2.

---

## 1. Prerequisites
- The server is running and reachable by its subdomain: `https://bugs.example.com` (`../server/README.md`).
- On the build machine: Google Chrome, Node.js 22+, PowerShell.

## 2. Build and pack — one command

```powershell
cd D:\projects\local_widget\extension
powershell -ExecutionPolicy Bypass -File scripts\pack-extension.ps1
```
The address is taken from `..\server\.env` (`APP_DOMAIN`), or pass it explicitly: `-Server https://bugs.example.com`.

The script:
1. builds the extension with this default address (`dist\`);
2. packs it into `..\server\extension-dist\adtask.crx` and writes `update.xml` next to it;
3. on the first run creates the key `keys\adtask.pem` — **keep a copy in a safe place** (Chrome identifies the
   extension by this key; if it is lost, the ID changes and the policy has to be redone). The key never goes to git;
4. writes `keys\adtask-policy.reg` — the same settings for testing on a single computer;
5. writes `keys\adtask-macos-chrome.plist` — the same policy for Macs managed by MDM (see [macOS](#macos));
6. prints the extension ID (32 letters a–p) and ready-made policy lines.

The site serves `server\extension-dist` at `https://bugs.example.com/extension/` (mounted in
`docker-compose.yml`). Check in a browser that `https://bugs.example.com/extension/update.xml` opens.

If the server is built on another machine, copy the contents of `server\extension-dist` (two files) there.

If Chrome is not found, pack manually: `chrome://extensions` → "Developer mode" → "Pack extension"
→ folder `extension\dist`, key `keys\adtask.pem` (empty the first time) → put the `.crx` into `server\extension-dist\adtask.crx`.

The file names `adtask.crx` / `adtask.pem` are kept from the first version so that existing installations keep their ID.
The extension itself is called Bug Stream (from version 0.4.0) and updates in place.

## 3. Chrome policy templates
1. Download "Chrome policy templates" (Chrome Enterprise).
2. Copy `chrome.admx` and `en-US\chrome.adml` (and other languages you need) into the central policy store:
   `\\<domain>\SYSVOL\<domain>\Policies\PolicyDefinitions\`.

## 4. Installation policy
`gpmc.msc` → new Group Policy Object → link it to the OU with the team's computers →
**Computer Configuration → Policies → Administrative Templates → Google → Google Chrome → Extensions →
"Configure extension management settings" (ExtensionSettings)**. The value is one line of JSON:

```json
{"EXTENSION_ID":{"installation_mode":"force_installed","update_url":"https://bugs.example.com/extension/update.xml","toolbar_pin":"force_pinned"}}
```

### Limit the sites the extension works on (recommended for infosec)
The extension can work on any site. To let it see **only internal sites**, add to the same JSON:

```json
{"EXTENSION_ID":{
  "installation_mode":"force_installed",
  "update_url":"https://bugs.example.com/extension/update.xml",
  "toolbar_pin":"force_pinned",
  "runtime_blocked_hosts":["*://*"],
  "runtime_allowed_hosts":["*://*.example.com","*://10.0.0.15","*://localhost"]
}}
```
Chrome will not let the extension read or change pages outside the list — on external sites it intercepts nothing
and does not send their addresses to the server. `runtime_allowed_hosts` holds your domains (`*://*.example.com` — all subdomains)
and individual IPs (`*://10.0.0.15`; masks like `10.*` are not supported), at most 100 entries, no paths.
After `gpupdate` check in `chrome://policy` that the policy was accepted without errors.

## 5. Server address by policy too (optional)
The address is already built in. To change it without rebuilding or to forbid another one — a registry setting
(**Computer Configuration → Preferences → Windows Settings → Registry**):

| Field | Value |
|---|---|
| Hive | `HKEY_LOCAL_MACHINE` |
| Key path | `SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\EXTENSION_ID\policy` |
| Name | `server` |
| Type | `REG_SZ` |
| Value | `https://bugs.example.com` |

## 6. Check
On an employee's computer: `gpupdate /force`, restart Chrome → `chrome://policy` (policies without errors) →
`chrome://extensions` (Bug Stream "installed by your administrator").

## 7. New version
1. Bump `version` in `static/manifest.json` (e.g. `0.4.0` → `0.4.1`).
2. Run `scripts\pack-extension.ps1` again — with the same `keys\adtask.pem`.

Chrome checks for updates by itself every few hours. Faster on one computer: `chrome://extensions` →
"Developer mode" → "Update".

---

## Path 2. Chrome Web Store "domain only"
- A developer account in the company's Google Workspace domain (one-time fee); the Workspace administrator allows
  publishing for the domain.
- A ZIP of the **contents** of `dist` (`manifest.json` at the archive root), a 128×128 icon, a 1280×800 screenshot,
  a privacy policy (a page with a link).
- Visibility **Private → domain only**. Google reviews it; for such extensions it is usually faster.
- Forced installation — with the same ExtensionSettings policy, but without `update_url`.
- Texts for the review form (purpose, explanation of every permission) — in `../SECURITY.md`, section 3.

---

## macOS

### Trying it on one Mac
`chrome://extensions` → **Developer mode** → **Load unpacked** → `extension/dist`, exactly as on Windows.
Keyboard shortcuts are `⌥⇧R` / `⌥⇧Y`. Chrome records only the tab, so no "Screen Recording" permission is needed.

### Building and packing on a Mac
Node.js 22+ and Chrome:
```bash
cd extension
npm ci
BUGSTREAM_SERVER=https://bugs.example.com npm run build
```
`scripts/pack-extension.ps1` also runs on macOS with PowerShell 7 (`brew install powershell`, then
`pwsh scripts/pack-extension.ps1 -Server https://bugs.example.com`; Chrome in an unusual place — add `-Chrome <path>`).
Besides the `.crx` and `update.xml` it writes `keys/adtask-macos-chrome.plist` — the policy below, ready to upload to
the MDM as custom settings for `com.google.Chrome`. Without PowerShell pack by hand:
`chrome://extensions` → **Pack extension** → folder `extension/dist`, key `keys/adtask.pem` → put the `.crx` into
`server/extension-dist/adtask.crx` and write `update.xml` as the script does. Use the **same key** as for Windows —
then the extension ID is the same everywhere.

### Rolling out to managed Macs
Group policy does not exist on macOS; the same Chrome policies are delivered by MDM as a configuration profile for the
`com.google.Chrome` domain. The `ExtensionSettings` value is the same JSON as in section 4:

```xml
<key>ExtensionSettings</key>
<dict>
  <key>EXTENSION_ID</key>
  <dict>
    <key>installation_mode</key><string>force_installed</string>
    <key>update_url</key><string>https://bugs.example.com/extension/update.xml</string>
    <key>toolbar_pin</key><string>force_pinned</string>
  </dict>
</dict>
```
`runtime_blocked_hosts` / `runtime_allowed_hosts` are added the same way (arrays of strings). Chrome installs
extensions from outside the store only on managed Macs (MDM profile or Chrome Browser Cloud Management).
The server address (section 5) goes into the profile for `com.google.Chrome.extensions.EXTENSION_ID` with the key
`server`. Check on the Mac: `chrome://policy` → **Reload policies**.
