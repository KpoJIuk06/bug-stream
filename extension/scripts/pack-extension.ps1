# Builds and packs the Bug Stream extension for installation by group policy (GPO).
#   cd extension
#   powershell -ExecutionPolicy Bypass -File scripts\pack-extension.ps1                 # address from ..\server\.env (APP_DOMAIN)
#   powershell -ExecutionPolicy Bypass -File scripts\pack-extension.ps1 -Server https://bugs.example.com
#   pwsh scripts/pack-extension.ps1 -Server https://bugs.example.com                    # macOS / Linux (PowerShell 7)
# Output:
#   ..\server\extension-dist\adtask.crx and update.xml - served by the site: https://<domain>/extension/...
#   keys\adtask.pem         - extension key (SECRET, never in git; keep a copy in a safe place)
#   keys\adtask-policy.reg  - registry settings for testing on a single computer
#   keys\adtask-macos-chrome.plist - the same policy for an MDM profile on macOS (com.google.Chrome)
# Details: docs\deploy.md

param(
    [string]$Server,
    [string]$Chrome      # path to Chrome if it is installed in an unusual place
)
$ErrorActionPreference = "Stop"

$ext     = Split-Path $PSScriptRoot -Parent                     # extension folder
$dist    = Join-Path $ext "dist"
$keys    = Join-Path $ext "keys"
$root    = Split-Path $ext -Parent
$public  = Join-Path (Join-Path $root "server") "extension-dist"
$key     = Join-Path $keys "adtask.pem"
New-Item -ItemType Directory -Force -Path $public, $keys | Out-Null

# Server address: parameter or APP_DOMAIN from server\.env
if (-not $Server) {
    $envFile = Join-Path (Join-Path $root "server") ".env"
    if (Test-Path $envFile) {
        $line = Get-Content $envFile -Encoding UTF8 | Where-Object { $_ -match "^\s*APP_DOMAIN\s*=" } | Select-Object -First 1
        if ($line) { $Server = "https://" + ($line -split "=", 2)[1].Trim() }
    }
}
if (-not $Server) { throw "Pass the address: -Server https://bugs.example.com (or set APP_DOMAIN in server\.env)" }
$Server = $Server.Trim().TrimEnd("/")
if ($Server -notmatch "^https?://") { $Server = "https://$Server" }

# --- 0. Build with this default address ---
Push-Location $ext
try {
    if (-not (Test-Path "node_modules")) { npm ci --no-audit --no-fund; if ($LASTEXITCODE) { throw "npm ci failed" } }
    $env:BUGSTREAM_SERVER = $Server
    npm run build; if ($LASTEXITCODE) { throw "Build failed" }
} finally { Remove-Item Env:\BUGSTREAM_SERVER -ErrorAction SilentlyContinue; Pop-Location }

$version = (Get-Content (Join-Path $dist "manifest.json") -Raw -Encoding UTF8 | ConvertFrom-Json).version

$onWindows = [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT
$candidates = if ($Chrome) { @($Chrome) } elseif ($onWindows) { @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) } else { @(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"
) }
$chrome = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $chrome) { throw "Chrome not found. Pack manually: chrome://extensions -> Pack extension (see docs\deploy.md)" }

# --- 1. Pack (separate profile - does not interfere with an open Chrome) ---
$crxOut = "$dist.crx"; $pemOut = "$dist.pem"
Remove-Item $crxOut, $pemOut -ErrorAction SilentlyContinue
$profile = Join-Path ([IO.Path]::GetTempPath()) "adtask-pack-profile"
if ($onWindows) {
    $arguments = @("--pack-extension=`"$dist`"", "--no-message-box", "--user-data-dir=`"$profile`"")
    if (Test-Path $key) { $arguments += "--pack-extension-key=`"$key`"" }
    Start-Process -FilePath $chrome -ArgumentList $arguments -Wait
} else {
    # macOS / Linux: the call operator waits and passes paths with spaces as they are
    $arguments = @("--pack-extension=$dist", "--no-message-box", "--user-data-dir=$profile")
    if (Test-Path $key) { $arguments += "--pack-extension-key=$key" }
    & $chrome @arguments 2>$null | Out-Null
}
if (-not (Test-Path $crxOut)) { throw "Chrome did not create the .crx. Try packing manually (docs\deploy.md, section 2)." }
if (Test-Path $pemOut) {
    Move-Item $pemOut $key -Force
    Write-Host "New key created: $key - keep a copy in a safe place!" -ForegroundColor Yellow
}
Move-Item $crxOut (Join-Path $public "adtask.crx") -Force

# --- 2. Extension ID from the key ---
$js = "const c=require('crypto'),fs=require('fs');const der=c.createPublicKey(fs.readFileSync(process.argv[1])).export({type:'spki',format:'der'});process.stdout.write([...c.createHash('sha256').update(der).digest('hex').slice(0,32)].map(h=>String.fromCharCode(97+parseInt(h,16))).join(''))"
$id = (& node -e $js $key).Trim()
if ($id -notmatch "^[a-p]{32}$") { throw "Could not compute the extension ID (Node.js required). Look up the ID in chrome://extensions after installing." }

# --- 3. update.xml ---
$updateUrl = "$Server/extension/update.xml"
$xml = @"
<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='$id'>
    <updatecheck codebase='$Server/extension/adtask.crx' version='$version' />
  </app>
</gupdate>
"@
[IO.File]::WriteAllText((Join-Path $public "update.xml"), $xml, (New-Object Text.UTF8Encoding($false)))

# --- 4. .reg for testing on a single computer ---
$settings = '{\"' + $id + '\":{\"installation_mode\":\"force_installed\",\"update_url\":\"' + $updateUrl + '\",\"toolbar_pin\":\"force_pinned\"}}'
$reg = @"
Windows Registry Editor Version 5.00

[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome]
"ExtensionSettings"="$settings"

[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\$id\policy]
"server"="$Server"
"@
[IO.File]::WriteAllText((Join-Path $keys "adtask-policy.reg"), $reg, (New-Object Text.UnicodeEncoding($false, $true)))

# --- 5. macOS: Chrome preferences for an MDM configuration profile (domain com.google.Chrome) ---
$plist = @"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>ExtensionSettings</key>
  <dict>
    <key>$id</key>
    <dict>
      <key>installation_mode</key><string>force_installed</string>
      <key>update_url</key><string>$updateUrl</string>
      <key>toolbar_pin</key><string>force_pinned</string>
    </dict>
  </dict>
</dict>
</plist>
"@
[IO.File]::WriteAllText((Join-Path $keys "adtask-macos-chrome.plist"), $plist, (New-Object Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "Done: Bug Stream $version" -ForegroundColor Green
Write-Host "  Extension ID:  $id"
Write-Host "  update.xml:     $updateUrl"
Write-Host "  crx:            $Server/extension/adtask.crx"
Write-Host ""
Write-Host "ExtensionSettings policy (one line):"
Write-Host ('{"' + $id + '":{"installation_mode":"force_installed","update_url":"' + $updateUrl + '","toolbar_pin":"force_pinned"}}')
Write-Host ""
Write-Host "Or ExtensionInstallForcelist:  $id;$updateUrl"
Write-Host "Server address for the extension:  HKLM\SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\$id\policy  server = $Server"
