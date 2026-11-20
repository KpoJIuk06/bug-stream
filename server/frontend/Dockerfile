# Images and dependencies can come from Nexus: see docs/nexus.md
ARG REGISTRY=

# ---- build ----
FROM ${REGISTRY}node:22-alpine AS build
ARG NPM_REGISTRY=
WORKDIR /app
COPY package.json package-lock.json ./
COPY npm/ /tmp/npm/
# Your own npm/.npmrc (with Nexus login) wins; otherwise NPM_REGISTRY; otherwise registry.npmjs.org
RUN if [ -f /tmp/npm/.npmrc ]; then cp /tmp/npm/.npmrc .npmrc; \
    elif [ -n "$NPM_REGISTRY" ]; then echo "registry=$NPM_REGISTRY" > .npmrc; fi \
 && npm ci --no-audit --no-fund \
 && rm -f .npmrc
COPY . .
RUN rm -f .npmrc npm/.npmrc && npm run build

# ---- run ----
# Unprivileged nginx: the process runs as uid 101 (nginx), not root; listens on 8080/8443
FROM ${REGISTRY}nginxinc/nginx-unprivileged:1.27-alpine
USER root
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx/http.conf.template nginx/https.conf.template /etc/nginx/bugstream/
COPY nginx/snippets/ /etc/nginx/snippets/
COPY nginx/15-bugstream-config.sh /docker-entrypoint.d/
RUN sed -i 's/\r$//' /docker-entrypoint.d/15-bugstream-config.sh /etc/nginx/bugstream/* /etc/nginx/snippets/* \
 && chmod +x /docker-entrypoint.d/15-bugstream-config.sh \
 && mkdir -p /etc/nginx/templates \
 && chown -R nginx:nginx /etc/nginx/templates /etc/nginx/conf.d
COPY --from=build /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080 8443
