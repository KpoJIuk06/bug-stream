You can put your own `settings.xml` for Nexus (with login and password) here — the build will use it.
`settings.xml` never goes to git (.gitignore). It is only needed during the build and is not part of the final image.
If Nexus allows anonymous access, `MAVEN_MIRROR_URL` in `.env` is enough.
