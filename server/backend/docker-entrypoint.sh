#!/bin/sh
# Starts the backend. If corporate CA certificates are mounted into /etc/bugstream/ca
# (*.crt / *.pem: Active Directory LDAPS, a TLS-inspecting proxy in front of Jira Cloud, ...),
# they are added to a copy of the JDK trust store first.
set -e

TRUST_OPTS=""
CA_DIR=/etc/bugstream/ca
if ls "$CA_DIR"/*.crt "$CA_DIR"/*.pem >/dev/null 2>&1; then
  STORE=/tmp/truststore.p12
  cp "$JAVA_HOME/lib/security/cacerts" "$STORE"
  chmod 600 "$STORE"
  for f in "$CA_DIR"/*.crt "$CA_DIR"/*.pem; do
    [ -f "$f" ] || continue
    keytool -importcert -noprompt -storepass changeit -keystore "$STORE" \
      -alias "corp-$(basename "$f")" -file "$f" >/dev/null
    echo "Trusted CA certificate: $(basename "$f")"
  done
  TRUST_OPTS="-Djavax.net.ssl.trustStore=$STORE -Djavax.net.ssl.trustStorePassword=changeit"
fi

# JAVA_OPTS: extra JVM options from .env, e.g. an outgoing proxy for Jira Cloud:
#   -Dhttps.proxyHost=proxy.corp.local -Dhttps.proxyPort=3128 -Dhttp.nonProxyHosts=*.corp.local
# shellcheck disable=SC2086
exec java -XX:MaxRAMPercentage=75 $TRUST_OPTS $JAVA_OPTS -jar /app/app.jar
