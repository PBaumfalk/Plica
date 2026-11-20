#!/usr/bin/env bash
# PLICA installieren oder aktualisieren (Docker Compose, Produktions-Image).
#
#   scripts/install.sh                      Test auf diesem Rechner: http://localhost:3000
#   scripts/install.sh --url https://formulare.kanzlei.de    Server hinter Reverse Proxy
#
# Optionen:
#   --url URL     Adresse, unter der PLICA im Browser erreichbar ist (APP_URL).
#                 Nur beim ersten Lauf; danach gilt der Wert in der Konfigurationsdatei.
#   --port PORT   Host-Port der App (Standard 3000), ebenfalls nur beim ersten Lauf.
#   --clamav      Virenscanner ClamAV mit einrichten (bis zu 3 GB RAM zusätzlich).
#   --no-build    Image nicht neu bauen (z. B. mit PLICA_IMAGE aus einer Registry).
#
# Wiederholbar: Eine vorhandene Konfiguration (.env), Datenbank und Dateien bleiben
# unverändert. Ein zweiter Lauf baut nur neu, startet und prüft den Betrieb.
# Umgebungsvariablen: PLICA_ENV_FILE (andere Konfigurationsdatei), COMPOSE_PROJECT_NAME.
set -euo pipefail
cd "$(dirname "$0")/.."

URL="" PORT="" CLAMAV=0 BUILD=1
while [ $# -gt 0 ]; do
  case "$1" in
    --url) URL="${2:?--url braucht eine Adresse}"; shift 2 ;;
    --port) PORT="${2:?--port braucht eine Zahl}"; shift 2 ;;
    --clamav) CLAMAV=1; shift ;;
    --no-build) BUILD=0; shift ;;
    -h|--help) sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unbekannte Option: $1 (Hilfe: scripts/install.sh --help)" >&2; exit 2 ;;
  esac
done

ENV_FILE="${PLICA_ENV_FILE:-.env}"
export PLICA_ENV_FILE="$ENV_FILE"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
step() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; [ -n "${2:-}" ] && printf '  %s\n' "$2" >&2; exit 1; }

# ── 1. Voraussetzungen ────────────────────────────────────────────────
step "Voraussetzungen prüfen"
[ -f compose.yml ] && [ -f .env.example ] || fail "compose.yml oder .env.example fehlt." "Bitte im Hauptordner des PLICA-Checkouts ausführen."
command -v docker >/dev/null || fail "Docker ist nicht installiert." "Linux: https://docs.docker.com/engine/install/ · Mac/Windows: Docker Desktop oder OrbStack."
docker info >/dev/null 2>&1 || fail "Docker läuft nicht oder dieser Benutzer darf es nicht verwenden." "Docker starten bzw. Benutzer zur Gruppe 'docker' hinzufügen (danach neu anmelden)."
ok "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null)"
cv=$(docker compose version --short 2>/dev/null) || fail "Docker Compose v2 fehlt." "Paket 'docker-compose-plugin' installieren."
cv=${cv#v}; major=${cv%%.*}; rest=${cv#*.}; minor=${rest%%.*}
if [ "$major" -lt 2 ] || { [ "$major" -eq 2 ] && [ "$minor" -lt 24 ]; }; then
  fail "Docker Compose $cv ist zu alt (mindestens 2.24)." "Docker bzw. das Compose-Plugin aktualisieren."
fi
ok "Docker Compose $cv"
command -v openssl >/dev/null || fail "openssl fehlt (für Zufallsschlüssel)." "Debian/Ubuntu: sudo apt install openssl"
command -v curl >/dev/null || fail "curl fehlt (für die Erfolgskontrolle)." "Debian/Ubuntu: sudo apt install curl"
ok "openssl und curl vorhanden"

# ── 2. Konfiguration ──────────────────────────────────────────────────
step "Konfiguration ($ENV_FILE)"
getvar() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -1 | sed 's/^"\(.*\)"$/\1/'; }
if [ -f "$ENV_FILE" ]; then
  ok "$ENV_FILE ist vorhanden und bleibt unverändert."
  [ -n "$URL$PORT" ] && echo "  Hinweis: --url/--port gelten nur beim ersten Lauf. Werte bitte in $ENV_FILE ändern."
  if grep -Eq '^(APP_URL|SECRET_KEY|POSTGRES_PASSWORD|S3_ROOT_PASSWORD)=.*<' "$ENV_FILE"; then
    fail "$ENV_FILE enthält noch Platzhalter (<…>)." "Werte ersetzen, z. B. mit: openssl rand -hex 32"
  fi
  if [ "$CLAMAV" = 1 ] && ! grep -q '^COMPOSE_PROFILES=.*clamav' "$ENV_FILE"; then
    printf '\n# Virenscanner (von scripts/install.sh --clamav)\nCLAMAV_HOST=clamav\nCOMPOSE_PROFILES=clamav\n' >> "$ENV_FILE"
    ok "Virenscanner in $ENV_FILE ergänzt."
  fi
else
  # Keine Konfiguration, aber Daten einer früheren Installation? Dann nicht mit neuen
  # Schlüsseln starten: Die alte Datenbank behält ihr Passwort, verschlüsselte Werte
  # wären mit einem neuen SECRET_KEY nicht mehr lesbar.
  PROJECT=${COMPOSE_PROJECT_NAME:-$(sed -n 's/^name:[[:space:]]*//p' compose.yml | head -1)}
  old=$(docker volume ls -q --filter "name=^${PROJECT}_(db|files)\$" | tr '\n' ' ')
  if [ -n "$old" ]; then
    fail "Es gibt Daten einer früheren PLICA-Installation (Volumes: ${old% }), aber keine $ENV_FILE." \
"Die frühere Konfiguration gehört zu diesen Daten. Wählen Sie bewusst einen Weg:
  • Frühere $ENV_FILE zurückkopieren und das Skript erneut starten (Daten bleiben erhalten).
  • Daneben neu installieren: COMPOSE_PROJECT_NAME=plica2 scripts/install.sh (alte Daten bleiben unberührt).
  • Alte Daten endgültig löschen: docker volume rm ${old% } (nicht rückgängig zu machen!)."
  fi
  PORT=${PORT:-3000}
  URL=${URL:-http://localhost:$PORT}
  URL=${URL%/}
  case "$URL" in http://*|https://*) ;; *) fail "--url muss mit http:// oder https:// beginnen." ;; esac
  # Hinter einem Reverse Proxy (https) X-Forwarded-For auswerten, lokal nicht
  case "$URL" in https://*) PROXY=true ;; *) PROXY=false ;; esac
  umask 077
  awk -v url="$URL" -v port="$PORT" -v proxy="$PROXY" \
      -v sk="$(openssl rand -hex 32)" -v pg="$(openssl rand -hex 24)" -v s3="$(openssl rand -hex 24)" '
    /^APP_URL=/           { print "APP_URL=" url; next }
    /^SECRET_KEY=/        { print "SECRET_KEY=" sk; next }
    /^POSTGRES_PASSWORD=/ { print "POSTGRES_PASSWORD=" pg; next }
    /^S3_ROOT_PASSWORD=/  { print "S3_ROOT_PASSWORD=" s3; next }
    /^PLICA_PORT=/        { print "PLICA_PORT=" port; next }
    /^TRUST_PROXY=/       { print "TRUST_PROXY=" proxy; next }
    { print }' .env.example > "$ENV_FILE.tmp"
  if [ "$CLAMAV" = 1 ]; then
    printf '\n# Virenscanner (von scripts/install.sh --clamav)\nCLAMAV_HOST=clamav\nCOMPOSE_PROFILES=clamav\n' >> "$ENV_FILE.tmp"
  fi
  if [ -n "${COMPOSE_PROJECT_NAME:-}" ]; then
    # Damit auch spätere „docker compose …“-Befehle in diesem Ordner dieses Projekt treffen
    printf '\n# Eigener Projektname (von scripts/install.sh)\nCOMPOSE_PROJECT_NAME=%s\n' "$COMPOSE_PROJECT_NAME" >> "$ENV_FILE.tmp"
  fi
  mv "$ENV_FILE.tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok "$ENV_FILE angelegt (Rechte 600) mit neuen Zufallsschlüsseln."
  echo "  WICHTIG: SECRET_KEY aus $ENV_FILE getrennt vom Server sichern und nie ändern."
fi
APP_URL=$(getvar APP_URL)
HOST_PORT=$(getvar PLICA_PORT); HOST_PORT=${HOST_PORT:-3000}
ok "Adresse: $APP_URL  (App-Port 127.0.0.1:$HOST_PORT)"

DC=(docker compose --env-file "$ENV_FILE")

# ── 3. Bauen und starten ──────────────────────────────────────────────
step "Bauen und starten (der erste Build dauert einige Minuten)"
if [ "$BUILD" = 1 ]; then
  "${DC[@]}" build --quiet app || fail "Das Image ließ sich nicht bauen." "Internetzugang prüfen; Details: docker compose build app"
  ok "Image gebaut"
fi
if ! "${DC[@]}" up -d --wait --wait-timeout 600; then
  "${DC[@]}" ps -a
  fail "Nicht alle Dienste sind gesund gestartet." "Logs ansehen: docker compose logs migrate app --tail 50"
fi
ok "Dienste laufen"

# ── 4. Erfolgskontrolle ───────────────────────────────────────────────
step "Betrieb prüfen"
health=""
for _ in $(seq 1 30); do
  health=$(curl -sS --max-time 5 "http://127.0.0.1:$HOST_PORT/healthz" 2>/dev/null || true)
  case "$health" in *'"status":"ok"'*) break ;; esac
  sleep 2
done
[ -n "$health" ] || fail "http://127.0.0.1:$HOST_PORT/healthz antwortet nicht." "Logs ansehen: docker compose logs app --tail 50"
case "$health" in *'"status":"ok"'*) ok "Healthcheck: $health" ;; *) fail "Healthcheck meldet einen Fehler: $health" ;; esac

setup=$("${DC[@]}" exec -T app plica setup-code 2>/dev/null || true)
echo
printf '\033[1mPLICA läuft.\033[0m\n'
case "$setup" in
  *Einrichtungscode:*)
    echo "  Ersteinrichtung: $APP_URL/einrichten"
    echo "  $setup"
    echo "  Mit diesem Code legen Sie das Inhaberkonto an. Bitte zügig einrichten." ;;
  *)
    echo "  Anmeldung: $APP_URL/login (PLICA ist bereits eingerichtet)" ;;
esac
case "$APP_URL" in
  http://localhost*|http://127.0.0.1*) ;;
  *) echo "  Der App-Port ist nur auf diesem Server erreichbar (127.0.0.1:$HOST_PORT)."
     echo "  Damit $APP_URL funktioniert, braucht es den Reverse Proxy: docs/handbuch/22-reverse-proxy.md" ;;
esac
echo "  Status: docker compose ps · Logs: docker compose logs -f app worker · Sicherung: docker compose exec app plica backup"
