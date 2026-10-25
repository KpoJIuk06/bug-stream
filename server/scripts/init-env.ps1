# Creates server\.env from .env.example with random secrets (Windows PowerShell 5+ / PowerShell 7).
#   powershell -ExecutionPolicy Bypass -File scripts\init-env.ps1                      # asks for the domain
#   powershell -ExecutionPolicy Bypass -File scripts\init-env.ps1 -Domain bugs.example.com
# Never overwrites an existing .env.
param([string]$Domain = "")
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $root ".env"
if (Test-Path $envFile) { throw ".env already exists - edit it or delete it first." }
if (-not $Domain) { $Domain = Read-Host "Domain (Enter = localhost for a local try)" }
if (-not $Domain) { $Domain = "localhost" }
$Domain = ($Domain -replace '^https?://', '').TrimEnd('/')

function New-Secret([int]$n) {
  $chars = [char[]]'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  $bytes = New-Object byte[] $n
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}
$dbPw = New-Secret 32; $jwt = New-Secret 64; $adminPw = New-Secret 16

$lines = Get-Content (Join-Path $root ".env.example") | ForEach-Object {
  switch -Regex ($_) {
    '^APP_DOMAIN='        { "APP_DOMAIN=$Domain"; break }
    '^POSTGRES_PASSWORD=' { "POSTGRES_PASSWORD=$dbPw"; break }
    '^JWT_SECRET='        { "JWT_SECRET=$jwt"; break }
    '^ADMIN_PASSWORD='    { "ADMIN_PASSWORD=$adminPw"; break }
    '^# APP_PUBLIC_URL='  { if ($Domain -eq 'localhost') { 'APP_PUBLIC_URL=http://localhost' } else { $_ }; break }
    '^# CORS_ORIGINS='    { if ($Domain -eq 'localhost') { 'CORS_ORIGINS=http://localhost,chrome-extension://*' } else { $_ }; break }
    default { $_ }
  }
}
# UTF-8 without BOM, LF — docker compose reads it as is
[System.IO.File]::WriteAllText($envFile, (($lines -join "`n") + "`n"), (New-Object System.Text.UTF8Encoding $false))

$site = if ($Domain -eq 'localhost') { 'http://localhost' } else { "https://$Domain" }
$admin = (Select-String -Path $envFile -Pattern '^ADMIN_EMAIL=(.*)').Matches[0].Groups[1].Value
Write-Host "Created server\.env" -ForegroundColor Green
Write-Host "  Site:           $site"
Write-Host "  Administrator:  $admin"
Write-Host "  Password:       $adminPw   (change it after the first sign-in)"
Write-Host "Next: docker compose up -d --build"
