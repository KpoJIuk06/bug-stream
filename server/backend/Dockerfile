# Images and dependencies can come from Nexus: see docs/nexus.md
ARG REGISTRY=

# ---- build ----
FROM ${REGISTRY}maven:3.9-eclipse-temurin-25 AS build
ARG MAVEN_MIRROR_URL=
WORKDIR /src
COPY maven/ /tmp/maven/
# Your own maven/settings.xml (with the Nexus login) wins; otherwise the MAVEN_MIRROR_URL mirror; otherwise Maven Central
RUN mkdir -p /root/.m2 \
 && if [ -f /tmp/maven/settings.xml ]; then cp /tmp/maven/settings.xml /root/.m2/settings.xml; \
    elif [ -n "$MAVEN_MIRROR_URL" ]; then printf '<settings><mirrors><mirror><id>nexus</id><mirrorOf>*</mirrorOf><url>%s</url></mirror></mirrors></settings>\n' "$MAVEN_MIRROR_URL" > /root/.m2/settings.xml; fi
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package

# ---- run ----
FROM ${REGISTRY}eclipse-temurin:25-jre
WORKDIR /app
RUN useradd --system --uid 1001 app && mkdir -p /data/storage && chown app /data/storage
COPY --from=build /src/target/bugtrack-backend-*.jar app.jar
COPY --chmod=755 docker-entrypoint.sh /app/docker-entrypoint.sh
USER app
EXPOSE 8080
ENTRYPOINT ["/app/docker-entrypoint.sh"]
