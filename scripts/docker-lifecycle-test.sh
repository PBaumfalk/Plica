#!/usr/bin/env bash
# Lebenszyklustest des Produktions-Images in einem eigenen Compose-Projekt:
# Build → Start → Einrichtung → Einreichung mit Upload → Worker (inkl. Wiederaufnahme
# nach Absturz) → Sicherung → Totalverlust → Wiederherstellung → Neustart.
# Lässt andere Compose-Projekte unberührt und räumt am Ende nur sich selbst auf.
#   scripts/docker-lifecycle-test.sh            (KEEP=1 lässt das Projekt laufen)
set -euo pipefail
cd "$(dirname "$0")/.."
P=plica-lifecycle
PORT=${PORT:-4765}
WORK=$(mktemp -d)
export TMPDIR_PLICA=$WORK
VARS="$WORK/lifecycle.vars"
cat > "$VARS" <<VARS
APP_URL=http://localhost:$PORT
SECRET_KEY=$(openssl rand -hex 32)
PLICA_ENV=production
PLICA_BIND=127.0.0.1
PLICA_PORT=$PORT
POSTGRES_PASSWORD=$(openssl rand -hex 16)
S3_ROOT_USER=plica
S3_ROOT_PASSWORD=$(openssl rand -hex 16)
SETUP_CODE=4242-4242-4242
VARS
export PLICA_ENV_FILE="$VARS"
C="docker compose -p $P --env-file $VARS -f compose.yml"
step() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
cleanup() { if [ "${KEEP:-0}" != 1 ]; then $C down -v --remove-orphans >/dev/null 2>&1 || true; fi; rm -rf "$WORK"; }
trap cleanup EXIT

step "Image bauen"
docker build -q -t plica:local . >/dev/null

step "Start"
$C up -d --wait 2>&1 | tail -2
curl -fsS "http://127.0.0.1:$PORT/healthz"; echo

step "Einrichtung über die Oberfläche"
node scripts/lifecycle/flow.mjs "http://localhost:$PORT" 4242-4242-4242 setup

step "Formular anlegen und als Externer mit Datei einreichen (Worker angehalten)"
$C stop worker >/dev/null
npx tsx --tsconfig tsconfig.json scripts/lifecycle/seed-form.ts kontakt | $C exec -T db psql -q -U plica -d plica -o /dev/null
$C exec -T db psql -q -U plica -d plica -c "update forms set published_version_id = (select id from form_versions v where v.form_id = forms.id order by number desc limit 1) where published_version_id is null"
# Automation: bei neuer Antwort ein PDF erzeugen (prüft die PDF-Erzeugung im Worker)
$C exec -T db psql -q -U plica -d plica -c "insert into workflows (workspace_id, form_id, name, trigger, steps) select workspace_id, id, 'PDF ablegen', 'submission.created', '[{\"id\":\"s1\",\"type\":\"pdf\"}]'::jsonb from forms where slug='kontakt'"
node scripts/lifecycle/flow.mjs "http://localhost:$PORT" - submit
$C exec -T db psql -U plica -d plica -tAc "select 'Antworten: '||count(*) from submissions; select 'Jobs wartend: '||count(*) from jobs where status='queued';"

step "Absturz simulieren: Job hängt als 'running' eines toten Workers"
$C exec -T db psql -q -U plica -d plica -c "update jobs set status='running', locked_at=now()-interval '1 hour', locked_by='toter-worker', attempts=1 where id = (select min(id) from jobs where type='workflow.run')"
$C start worker >/dev/null
for i in $(seq 1 45); do
  open=$($C exec -T db psql -U plica -d plica -tAc "select count(*) from jobs where status in ('queued','running')")
  [ "$open" = 0 ] && break; sleep 2
done
$C exec -T db psql -U plica -d plica -tAc "select type||': '||status||' (Versuche '||attempts||')' from jobs order by id"
[ "$open" = 0 ] || { echo "Jobs wurden nicht abgearbeitet"; $C logs worker --tail 40; exit 1; }
pdfs=$($C exec -T db psql -U plica -d plica -tAc "select count(*) from files where kind='pdf' and size > 1000")
echo "Vom Worker erzeugte PDFs: $pdfs"
[ "$pdfs" = 1 ] || { $C exec -T db psql -U plica -d plica -c "select status, log from workflow_runs"; exit 1; }

step "Sicherung"
$C exec -T app plica backup
F=$($C exec -T app sh -c 'ls -t /backups/*.tar.gz | head -1')
$C exec -T app plica verify "$F"

step "Totalverlust: Datenbank und Dateien löschen"
$C exec -T db psql -q -U plica -d plica -c "drop schema public cascade; create schema public; drop schema drizzle cascade;" 2>/dev/null
$C exec -T db psql -U plica -d plica -tAc "select 'Tabellen: '||count(*) from pg_tables where schemaname='public'"

step "Wiederherstellung"
$C exec -T app plica restore "$F" --yes
$C restart app worker >/dev/null
sleep 6
got=$($C exec -T db psql -U plica -d plica -tAc "select data->>'name'||' / '||(data->'doc'->0->>'name') from submissions")
files=$($C exec -T db psql -U plica -d plica -tAc "select count(*) from files")
echo "Dateien nach Wiederherstellung: $files"
echo "Antwort: $got"
[ "$got" = "Erika Mustermann / plica-vollmacht.pdf" ] || { echo "Wiederherstellung unvollständig"; exit 1; }
key=$($C exec -T db psql -U plica -d plica -tAc "select storage_key from files where kind='upload' limit 1")
$C exec -T app node --input-type=module -e "
const {S3Client,GetObjectCommand}=await import('/app/node_modules/@aws-sdk/client-s3/dist-cjs/index.js');
const c=new S3Client({endpoint:process.env.S3_ENDPOINT,region:'us-east-1',forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY,secretAccessKey:process.env.S3_SECRET_KEY}});
const r=await c.send(new GetObjectCommand({Bucket:process.env.S3_BUCKET||'plica',Key:'$key'}));
const s=await r.Body.transformToString(); if(!s.startsWith('%PDF-')) process.exit(1); console.log('Datei wiederhergestellt:', s.length, 'Bytes');"
curl -fsS "http://127.0.0.1:$PORT/healthz"; echo
step "Lebenszyklustest bestanden"
