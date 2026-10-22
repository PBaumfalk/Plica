# syntax=docker/dockerfile:1.7
# PLICA – Produktions-Image (App, Worker und CLI aus demselben Image)

ARG NODE_IMAGE=node:24-bookworm-slim

# ---------- Abhängigkeiten ----------
FROM ${NODE_IMAGE} AS deps
WORKDIR /src
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

# ---------- Build ----------
FROM ${NODE_IMAGE} AS build
WORKDIR /src
RUN corepack enable
COPY --from=deps /src/node_modules ./node_modules
COPY . .
# Nur für den Build: Platzhalter, damit die Konfigurationsprüfung nicht anschlägt.
# Zur Laufzeit gelten ausschließlich die Werte aus der .env-Datei.
ENV NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=postgres://build:build@127.0.0.1:1/build \
    APP_URL=http://localhost:3000 \
    SECRET_KEY=build-time-placeholder-not-used-at-runtime-0000000 \
    S3_ACCESS_KEY=build S3_SECRET_KEY=build
RUN mkdir -p public && pnpm exec next build && node scripts/build-node.mjs \
 # Schriften für die PDF-Erzeugung (liest node_modules/@fontsource/*/files)
 && mkdir -p /fonts/@fontsource && cp -RL node_modules/@fontsource/hanken-grotesk node_modules/@fontsource/newsreader /fonts/@fontsource/

# ---------- Laufzeit ----------
FROM ${NODE_IMAGE} AS runtime
ARG PLICA_VERSION=0.1.0
LABEL org.opencontainers.image.title="PLICA" \
      org.opencontainers.image.description="Selbst gehostete Formularplattform" \
      org.opencontainers.image.version="${PLICA_VERSION}" \
      org.opencontainers.image.licenses="MIT"

# PostgreSQL-18-Client für Sicherung und Wiederherstellung (pg_dump/pg_restore)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-18 \
 && apt-get purge -y curl && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/* \
 # Paketmanager werden zur Laufzeit nicht gebraucht – kleinere Angriffsfläche
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 PLICA_VERSION=${PLICA_VERSION} BACKUP_DIR=/backups

COPY --from=build --chown=node:node /src/.next/standalone ./
COPY --from=build --chown=node:node /src/.next/static ./.next/static
COPY --from=build --chown=node:node /src/public ./public
COPY --from=build --chown=node:node /src/drizzle ./drizzle
COPY --from=build --chown=node:node /src/dist ./dist
COPY --from=build --chown=node:node /fonts/@fontsource ./node_modules/@fontsource
COPY --chmod=755 docker/plica /usr/local/bin/plica

RUN mkdir -p /backups /app/.next/cache && chown node:node /backups /app/.next/cache
USER node
VOLUME ["/backups"]
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD ["plica", "health"]
CMD ["node", "server.js"]
