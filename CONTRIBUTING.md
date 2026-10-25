# Contributing to Bug Stream

Thanks for helping! Bug reports, ideas and pull requests are welcome.

## Before you start
- For a bug, open an issue with steps to reproduce, what you expected and what happened; logs from
  `docker compose logs backend` help a lot. **Never paste secrets** (`.env`, tokens, passwords).
- For a larger change, open an issue first so we can agree on the approach.
- Security problems: do not open a public issue — see [SECURITY.md](SECURITY.md).

## Local setup
See "Quick start" and "Development" in the [README](README.md). Requirements: Docker, Java 25 + Maven (backend),
Node.js 22+ (site, extension, widget).

## Checks before a pull request
```bash
cd server/backend  && mvn -q verify                       # compiles and runs the tests
cd server/frontend && npm ci && npx tsc --noEmit && npm run build
cd extension       && npm ci && npm run build
cd widget          && npm ci && npm run build
```
The same checks run in GitHub Actions (`.github/workflows/ci.yml`).

## Conventions
- **Database:** never edit an applied Flyway migration; add a new `V<n>__description.sql`.
- **Texts:** write UI texts in English inside `t("…")` (site) or `t("…")` / `data-i18n` (extension);
  add the Russian and Azerbaijani translations to `server/frontend/src/i18n/ru.ts`, `az.ts`
  and `extension/src/shared/i18n-dict.ts`. Data stored in reports is always English.
- **Secrets** are never logged, returned by the API or written to the audit log; tokens and passwords that must be
  stored are encrypted with `SecretCipher` (AES-GCM).
- `extension/src/core` and `widget/src/core` are the same code — change both.
- Keep pull requests focused; describe what changed and how you tested it.

## License
By contributing you agree that your contribution is licensed under the [Apache License 2.0](LICENSE).
