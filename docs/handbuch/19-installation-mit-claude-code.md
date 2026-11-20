# 19 · Installation mit Claude Code

Mit [Claude Code](https://code.claude.com/docs/en/overview) installieren Sie PLICA im Gespräch: Claude prüft den Rechner, führt die Installationsanleitung aus, kontrolliert den Start und nennt Ihnen am Ende die Adresse und den Einrichtungscode. Jeden Befehl zeigt Claude vorher an; Sie bestätigen ihn oder lehnen ab.

Dasselbe ohne Claude Code beschreibt [Kapitel 20](20-installation.md). Die Befehle, die Claude ausführt, stehen [unten](#was-dabei-im-hintergrund-passiert) zum Nachvollziehen.

## Was Sie vorab bereitstellen

| Was | Warum | Prüfen mit |
|---|---|---|
| Ein Rechner oder Server, siehe [Unterstützte Plattformen](20-installation.md#unterstützte-plattformen) | PLICA läuft in Docker | – |
| Docker mit Compose v2.24 oder neuer | Container für App, Datenbank und Speicher | `docker compose version` |
| `git`, `openssl`, `curl` | Checkout, Zufallsschlüssel, Erfolgskontrolle | `git --version` |
| Rund 4 GB freien Arbeitsspeicher, 20 GB Platte | Build und Betrieb | – |
| Ein Claude-Abo mit Claude Code (Pro, Max, Team oder Enterprise) oder ein Claude-Console-Konto | Anmeldung in Claude Code; der kostenlose Plan enthält Claude Code nicht | – |
| Zugriff auf das Repository | Checkout, siehe unten | – |
| Optional: die künftige Adresse, z. B. `https://plica.example.de` | sonst entsteht eine Testinstallation unter `http://localhost:3000` | – |

Auf einem Server ohne grafische Oberfläche arbeiten Sie per SSH. Melden Sie sich mit einem Benutzer an, der Docker verwenden darf (Gruppe `docker`).

## 1. Claude Code installieren

Nach der offiziellen Anleitung ([Set up Claude Code](https://code.claude.com/docs/en/setup)):

macOS, Linux und Windows mit WSL:

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

Alternativ auf dem Mac: `brew install --cask claude-code`. Danach ein neues Terminal öffnen und prüfen:

```bash
claude --version
```

Die Ausgabe nennt eine Versionsnummer mit „(Claude Code)“. Meldet das Terminal „command not found“, hilft die [Fehlerbehebung der Installation](https://code.claude.com/docs/en/troubleshoot-install). `claude doctor` prüft die Installation, ohne eine Sitzung zu starten.

Windows ohne WSL wird von Claude Code unterstützt, PLICA installiert sich dort aber nur über WSL 2 und Docker Desktop (siehe [Plattformen](20-installation.md#unterstützte-plattformen)). Arbeiten Sie unter Windows deshalb im WSL-Terminal.

## 2. PLICA herunterladen

```bash
git clone https://github.com/PBaumfalk/Plica.git plica
cd plica
```

Auf einem Server bietet sich `/opt/plica` an (`sudo git clone … /opt/plica`, danach `sudo chown -R $USER /opt/plica`).

**Ist das Repository privat**, brauchen Sie Lesezugriff: eine Einladung als Mitarbeiter (Collaborator) oder ein [Fine-grained Personal Access Token](https://docs.github.com/de/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) mit der Berechtigung **Contents: Read-only** für dieses Repository. Am einfachsten mit der GitHub-Kommandozeile:

```bash
gh auth login
gh repo clone PBaumfalk/Plica plica
```

## 3. Claude Code im PLICA-Ordner öffnen

```bash
cd plica          # bzw. cd /opt/plica
claude
```

Starten Sie Claude Code **im Hauptordner des Checkouts**, also dort, wo `compose.yml` und `README.md` liegen. Beim ersten Start meldet sich Claude Code über den Browser an und fragt, ob Sie dem Ordner vertrauen. Bestätigen Sie beides.

## 4. Den Installationsprompt einfügen

Kopieren Sie den folgenden Text unverändert in Claude Code. Wenn PLICA eine echte Adresse bekommen soll, ersetzen Sie in der letzten Zeile `localhost` durch diese Adresse, z. B. `Adresse: https://plica.example.de`.

```text
Installiere PLICA in diesem Ordner nach docs/handbuch/20-installation.md. Arbeite die Schritte der Reihe nach ab und berichte kurz nach jedem Schritt.

1. Umgebung prüfen: Betriebssystem und Prozessor, ob Docker läuft und mein Benutzer es verwenden darf, Docker Compose ab Version 2.24, git, openssl und curl, freier Arbeitsspeicher und Plattenplatz, und ob der App-Port (Standard 3000) frei ist. Fehlt etwas, nenne den passenden Installationsbefehl für dieses System und warte auf meine Zustimmung, bevor du Systempakete installierst oder Dienste startest.
2. Installation: Führe scripts/install.sh aus. Ist unten eine Adresse mit https:// angegeben, rufe es mit --url <Adresse> auf, sonst ohne Optionen. Eine vorhandene .env, die Datenbank und die Dateien dürfen weder überschrieben noch gelöscht werden. Lies und zeige keine Inhalte der .env und gib keine Passwörter oder Schlüssel aus.
3. Erfolg prüfen: docker compose ps muss app, db und storage als healthy zeigen, worker als laufend und migrate als beendet mit Exit 0. curl http://127.0.0.1:<App-Port>/healthz muss "status":"ok" liefern. Rufe außerdem die Startseite auf und prüfe, dass sie auf /einrichten oder /login weiterleitet.
4. Bei einem Fehler: Lies die Ausgabe von docker compose logs der betroffenen Dienste, behebe die Ursache und führe scripts/install.sh erneut aus. Das Skript ist wiederholbar. Ändere keinen Programmcode, ohne mich zu fragen.
5. Abschluss: Nenne mir die Adresse der Ersteinrichtung oder Anmeldung, den Einrichtungscode (docker compose exec app plica setup-code), die Befehle für Status, Logs, Stoppen, Starten und Sichern und erinnere mich, SECRET_KEY aus der .env getrennt vom Server aufzubewahren. Bei einer https-Adresse nenne zusätzlich die nächsten Schritte für den Reverse Proxy aus docs/handbuch/22-reverse-proxy.md.

Adresse: localhost
```

Claude zeigt jeden Befehl vor der Ausführung an. Lesen Sie ihn und bestätigen Sie mit **Yes**. Sicherheitsrelevante Rückfragen (etwa `sudo` oder das Installieren von Paketen) bestätigen nur Sie selbst.

## 5. Ergebnis

Am Ende meldet Claude etwa:

```text
PLICA läuft.
  Ersteinrichtung: http://localhost:3000/einrichten
  Einrichtungscode: 1480-4759-7510
```

Öffnen Sie die Adresse im Browser und legen Sie mit dem Code das Inhaberkonto an ([Erste Schritte](00-erste-schritte.md#der-allererste-start)). Auf einem Server ohne Browser erreichen Sie die Testinstallation über einen SSH-Tunnel: `ssh -L 3000:127.0.0.1:3000 benutzer@server`, danach `http://localhost:3000` auf Ihrem Rechner öffnen.

Für den echten Betrieb fehlen dann noch Reverse Proxy mit TLS ([Kapitel 22](22-reverse-proxy.md)), E-Mail-Versand ([Kapitel 21](21-konfiguration.md#e-mail)) und Sicherungen ([Kapitel 23](23-sicherung.md)). Claude Code hilft auch dabei. Bitten Sie zum Beispiel: „Richte nach docs/handbuch/23-sicherung.md eine tägliche Sicherung per cron ein und zeige mir vorher jeden Befehl.“

## Was dabei im Hintergrund passiert

Claude führt im Kern `scripts/install.sh` aus. Das Skript macht genau diese Schritte, die Sie auch von Hand ausführen können:

| Schritt | Skript | Manuell |
|---|---|---|
| Voraussetzungen | prüft Docker, Docker-Rechte, Compose ≥ 2.24, openssl, curl; bricht mit einer verständlichen Meldung ab | `docker info`, `docker compose version` |
| Konfiguration | legt `.env` aus `.env.example` an, nur wenn sie fehlt: Adresse, Port, neue Zufallswerte für `SECRET_KEY`, `POSTGRES_PASSWORD`, `S3_ROOT_PASSWORD`, Rechte 600. Eine vorhandene `.env` bleibt unverändert; enthält sie noch Platzhalter `<…>`, bricht das Skript ab | `cp .env.example .env`, Werte mit `openssl rand -hex 32` ersetzen, `chmod 600 .env` |
| Bauen | baut das Image `plica:local` | `docker compose build app` |
| Starten | startet alle Dienste und wartet, bis sie gesund sind (höchstens 10 Minuten) | `docker compose up -d --wait` |
| Kontrolle | ruft `/healthz` ab, erwartet `"status":"ok"` | `curl http://127.0.0.1:3000/healthz` |
| Abschluss | zeigt Einrichtungscode und Adresse bzw. „bereits eingerichtet“ | `docker compose exec app plica setup-code` |

Optionen: `--url https://…` (Adresse), `--port 3001` (anderer Port), `--clamav` (Virenscanner), `--no-build` (fertiges Image aus `PLICA_IMAGE`). `scripts/install.sh --help` zeigt alle.

Ein zweiter Aufruf ist gefahrlos. Er behält Konfiguration, Datenbank und Dateien, baut das Image neu und startet geänderte Dienste. Deshalb ist das Skript auch der einfachste Weg für Updates nach `git pull` ([Kapitel 24](24-updates.md)).

## Wenn es hakt

| Meldung | Bedeutung | Abhilfe |
|---|---|---|
| `Docker läuft nicht oder dieser Benutzer darf es nicht verwenden.` | Docker-Dienst gestoppt oder Benutzer nicht in der Gruppe `docker` | `sudo systemctl start docker` bzw. `sudo usermod -aG docker $USER`, neu anmelden |
| `Docker Compose … ist zu alt` | Compose-Plugin vor 2.24 | Docker nach der [offiziellen Anleitung](https://docs.docker.com/engine/install/) aktualisieren |
| `.env enthält noch Platzhalter` | `.env` wurde von Hand angelegt, aber nicht vollständig ausgefüllt | Werte ersetzen oder `.env` umbenennen und Skript neu starten (erzeugt neue Werte – nur bei einer neuen Installation!) |
| `Es gibt Daten einer früheren PLICA-Installation …, aber keine .env.` | Auf dem Rechner liegen Docker-Volumes einer älteren Installation, deren Konfiguration fehlt. Neue Schlüssel würden nicht zu diesen Daten passen | eine der drei angezeigten Möglichkeiten bewusst wählen; im Zweifel daneben installieren mit `COMPOSE_PROJECT_NAME=plica2 scripts/install.sh` |
| `Nicht alle Dienste sind gesund gestartet.` | meist Port belegt oder zu wenig Arbeitsspeicher | `docker compose logs migrate app --tail 50`; anderen Port mit `--port` |
| `/healthz antwortet nicht` | App startet noch oder stürzt ab | `docker compose logs app --tail 50` |
| Claude Code fragt bei jedem Befehl | gewollt; Sie behalten die Kontrolle | mit **Yes** bestätigen; Berechtigungsmodi erklärt die [offizielle Doku](https://code.claude.com/docs/en/permission-modes) |

← [Handbuch](README.md) · weiter: [Installation](20-installation.md) →
