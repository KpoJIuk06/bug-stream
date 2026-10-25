# Building through Nexus

The build needs three kinds of dependencies. All three can come from Nexus — then the server needs no internet access.

| What | Default source | `.env` variable | Nexus repository |
|---|---|---|---|
| Docker images: `postgres:18`, `maven:3.9-eclipse-temurin-25`, `eclipse-temurin:25-jre`, `node:22-alpine`, `nginx:1.27-alpine` | Docker Hub | `DOCKER_REGISTRY` | docker (proxy of `registry-1.docker.io`) |
| Java libraries (Spring Boot 4.1, PostgreSQL JDBC, Flyway, jjwt) | Maven Central | `MAVEN_MIRROR_URL` | maven2 (proxy/group of Maven Central) |
| npm packages of the site and the widget | registry.npmjs.org | `NPM_REGISTRY` | npm (proxy/group of npmjs) |

## Without a login (Nexus allows anonymous reads)
```ini
DOCKER_REGISTRY=nexus.example.com:8083/
MAVEN_MIRROR_URL=https://nexus.example.com/repository/maven-public/
NPM_REGISTRY=https://nexus.example.com/repository/npm-group/
```
`DOCKER_REGISTRY` ends with a slash: the image name is simply appended to it (`nexus.example.com:8083/postgres:18`).
If the Docker registry is closed, run `docker login nexus.example.com:8083` on the server.

## With a login
- Maven: put `backend/maven/settings.xml` (example — `settings.xml.example`).
- npm: put `frontend/npm/.npmrc` (example — `.npmrc.example`); for the widget — `widget/.npmrc`.

These files never go to git and are used only during the build — they are not part of the final images
(multi-stage build: only the finished `.jar` or the site folder is copied into the image).

## Publishing your own images to Nexus
To only download on the server instead of building:
```bash
docker compose build
docker tag bug-stream-backend  nexus.example.com:8083/bug-stream/backend:0.3.0
docker tag bug-stream-frontend nexus.example.com:8083/bug-stream/frontend:0.3.0
docker push nexus.example.com:8083/bug-stream/backend:0.3.0
docker push nexus.example.com:8083/bug-stream/frontend:0.3.0
```
Then in `docker-compose.yml` replace `build:` of `backend` and `frontend` with `image: nexus.example.com:8083/bug-stream/<name>:0.3.0`.

## Checking dependencies
- Java: `mvn -q dependency:tree` in `backend/`; scanning — Nexus IQ / OWASP Dependency-Check.
- npm: `npm ls --omit=dev` in `frontend/` and `widget/`; exact versions and hashes are in `package-lock.json`.
