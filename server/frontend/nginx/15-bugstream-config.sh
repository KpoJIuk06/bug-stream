#!/bin/sh
# Picks the nginx configuration by TLS_MODE. Then the image's standard step (20-envsubst-on-templates)
# substitutes APP_DOMAIN / TLS_CERT / TLS_KEY and writes the result to /etc/nginx/conf.d/default.conf.
set -e
mkdir -p /etc/nginx/templates
case "${TLS_MODE:-proxy}" in
  nginx)
    if [ ! -f "/etc/nginx/certs/${TLS_CERT:-fullchain.pem}" ] || [ ! -f "/etc/nginx/certs/${TLS_KEY:-privkey.pem}" ]; then
      echo "bug-stream: TLS_MODE=nginx, but certs/ has no ${TLS_CERT:-fullchain.pem} or ${TLS_KEY:-privkey.pem}" >&2
      exit 1
    fi
    cp /etc/nginx/bugstream/https.conf.template /etc/nginx/templates/default.conf.template ;;
  *)
    cp /etc/nginx/bugstream/http.conf.template /etc/nginx/templates/default.conf.template ;;
esac
echo "bug-stream: https=${TLS_MODE:-proxy}, domain ${APP_DOMAIN}"
