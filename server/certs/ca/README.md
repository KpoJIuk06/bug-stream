# Corporate CA certificates (optional)

Put the root / intermediate certificates of your internal CA here as `*.crt` or `*.pem` files.
The backend adds them to its trust store on start. Needed when:

- Active Directory is reached over `ldaps://` with a certificate issued by the internal CA;
- outgoing HTTPS (Jira Cloud) goes through a TLS-inspecting proxy.

Only public certificates belong here — never private keys. `*.crt` and `*.pem` are ignored by git.
