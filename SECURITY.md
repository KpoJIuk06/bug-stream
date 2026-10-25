# Security policy

## Reporting a vulnerability
Please **do not** open a public issue. Use GitHub's private reporting instead:
**Security → Report a vulnerability** on this repository. Include the affected version or commit, steps to reproduce
and the impact. You will get an answer as soon as possible; please give us reasonable time to fix the problem before
disclosing it.

## Supported versions
Only the latest release (the `main` branch) receives security fixes.

## Scope and design notes
- Bug Stream is meant to run on a server you control. It records what the page shows and sends — including request
  bodies and typed values (password fields are masked). See [extension/SECURITY.md](extension/SECURITY.md) and
  [widget/SECURITY.md](widget/SECURITY.md) for exactly what is collected and where it goes.
- Secrets (Jira / Slack tokens, SMTP / LDAP passwords) are stored encrypted with a key derived from
  `INTEGRATION_SECRET` (or `JWT_SECRET`); refresh tokens, widget keys, one-time codes and links are stored only as hashes.
- The server refuses to start on a non-localhost address while placeholder secrets from `.env.example` are used;
  create `.env` with `server/scripts/init-env.sh` / `init-env.ps1`.
