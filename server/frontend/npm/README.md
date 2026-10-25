You can put your own `.npmrc` for Nexus (with a token) here — the build will use it (see `.npmrc.example`).
The `.npmrc` file never goes to git. It is only needed during the build and is not part of the final image.
If Nexus allows anonymous access, `NPM_REGISTRY` in `.env` is enough.
