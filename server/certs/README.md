For `TLS_MODE=nginx` put the subdomain certificate here:

- `fullchain.pem` — certificate + intermediates (the chain)
- `privkey.pem` — private key

The names can be changed in `.env` (`TLS_CERT`, `TLS_KEY`). `*.pem`, `*.key`, `*.crt` files never go to git.
With `TLS_MODE=proxy` this folder is not needed — HTTPS terminates at the corporate load balancer.

Corporate root CAs that the backend must trust (LDAPS, Jira behind a corporate proxy, Slack via proxy)
go to `certs/ca/` — see `certs/ca/README.md`.
