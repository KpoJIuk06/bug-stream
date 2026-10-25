#!/usr/bin/env sh
# Creates server/.env from .env.example with random secrets.
#   sh scripts/init-env.sh                       # asks for the domain (Enter = localhost)
#   sh scripts/init-env.sh bugs.example.com      # real installation behind HTTPS
# Never overwrites an existing .env.
set -eu
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  echo ".env already exists — edit it or delete it first." >&2
  exit 1
fi
domain="${1:-}"
if [ -z "$domain" ]; then
  printf "Domain (Enter = localhost for a local try): "
  read -r domain || true
fi
domain="${domain:-localhost}"
domain="$(printf %s "$domain" | sed -E -e 's#^https?://##' -e 's#/*$##')"

rand() { LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$1"; }
db_pw="$(rand 32)"
jwt="$(rand 64)"
admin_pw="$(rand 16)"

sed -e "s#^APP_DOMAIN=.*#APP_DOMAIN=${domain}#" \
    -e "s#^POSTGRES_PASSWORD=.*#POSTGRES_PASSWORD=${db_pw}#" \
    -e "s#^JWT_SECRET=.*#JWT_SECRET=${jwt}#" \
    -e "s#^ADMIN_PASSWORD=.*#ADMIN_PASSWORD=${admin_pw}#" \
    .env.example > .env

if [ "$domain" = "localhost" ]; then
  # plain http on this computer: links and CORS must use http://
  sed -i.bak -e "s|^# APP_PUBLIC_URL=.*|APP_PUBLIC_URL=http://localhost|" \
             -e "s|^# CORS_ORIGINS=.*|CORS_ORIGINS=http://localhost,chrome-extension://*|" .env && rm -f .env.bak
fi
chmod 600 .env

echo "Created server/.env"
echo "  Site:            $( [ "$domain" = localhost ] && echo http://localhost || echo https://$domain )"
echo "  Administrator:   $(grep '^ADMIN_EMAIL=' .env | cut -d= -f2)"
echo "  Password:        ${admin_pw}   (change it after the first sign-in)"
echo "Next: docker compose up -d --build"
