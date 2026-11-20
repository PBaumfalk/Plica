# 29 · Funktionsliste

Alle Funktionen von PLICA mit der nötigen Rolle oder Voraussetzung, der Stelle in Oberfläche und Code und dem Handbuchabschnitt, der sie erklärt. Rollen: **L** Leser, **P** Prüfer, **B** Bearbeiter, **A** Administrator, **I** Inhaber; „ab P“ heißt Prüfer und alle höheren Rollen. Die Rechte prüft der Server ([`src/server/auth/rbac.ts`](../../src/server/auth/rbac.ts)).

Stand der Funktionen: Alle hier aufgeführten Funktionen sind im ausgelieferten Stand vollständig nutzbar; als Vorschau oder Alpha gekennzeichnete Funktionen gibt es nicht. Bekannte Grenzen stehen in [Kapitel 28](28-bekannte-einschraenkungen.md). Optionale Module sind mit ihrer Voraussetzung markiert.

## Installation, Anmeldung und Konto

| Funktion | Rolle oder Voraussetzung | Fundstelle | Handbuch |
|---|---|---|---|
| Installationsskript (prüfen, konfigurieren, bauen, starten, Healthcheck) | Docker, Compose ≥ 2.24, openssl, curl | `scripts/install.sh` | [20](20-installation.md#schnellweg-installationsskript), [19](19-installation-mit-claude-code.md#was-dabei-im-hintergrund-passiert) |
| Installation mit Claude Code | Claude-Code-Zugang | Prompt im Handbuch | [19](19-installation-mit-claude-code.md#4-den-installationsprompt-einfügen) |
| Ersteinrichtung mit Einrichtungscode | nur solange kein Konto existiert | `/einrichten`: Code → Konto → Workspace; `src/app/(auth)/einrichten/setup-wizard.tsx`, `src/server/setup.ts` | [0](00-erste-schritte.md#der-allererste-start), [20](20-installation.md#ersteinrichtung) |
| Willkommensseite, alle zehn Vorlagen als Beispiele anlegen | nach der Einrichtung; Vorlagen ab B | `/willkommen`; `src/components/templates/welcome.tsx` | [0](00-erste-schritte.md#die-willkommensseite) |
| Anmeldung mit E-Mail und Passwort, Bremse gegen Passwortraten | Konto mit Passwort | `/login`; `src/app/(auth)/login/login-form.tsx`, `src/server/lib/ratelimit.ts` | [1](01-ueberblick.md#anmelden), [10](10-team-rollen.md#konto-und-sicherheit) |
| Zwei-Faktor-Anmeldung (TOTP) mit 8 Wiederherstellungscodes | Konto mit Passwort | Einstellungen → Konto → Zwei-Faktor-Anmeldung; `/login/zwei-faktor`; `src/components/settings/two-factor.tsx` | [10](10-team-rollen.md#konto-und-sicherheit) |
| Anmeldung über OIDC (authentik u. a.), Rollen aus Gruppen, Abmelden beim Anbieter | optional: `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | `/login` → „Mit … anmelden“; `src/server/auth/oidc.ts` | [21](21-konfiguration.md#anmeldung-über-authentik-oidc), [10](10-team-rollen.md#rollen-bei-anmeldung-über-sso) |
| Notzugang bei SSO-Ausfall | Server-Shell | `plica reset-password <email> --sso-notzugang`, `/login?lokal=1` | [21](21-konfiguration.md#notzugang), [25](25-betrieb-cli.md#kommandozeile-plica) |
| Einladung annehmen | gültiger Link (7 Tage, einmalig) | `/einladung/[token]` → „Konto anlegen und beitreten“ | [0](00-erste-schritte.md#einladung-annehmen-und-anmelden), [10](10-team-rollen.md#personen-einladen) |
| Profil, Passwort, angemeldete Geräte | alle | Einstellungen → Konto | [10](10-team-rollen.md#konto-und-sicherheit) |

## Oberfläche

| Funktion | Rolle oder Voraussetzung | Fundstelle | Handbuch |
|---|---|---|---|
| Seitenleiste: Formulare, Freigaben, Vorlagen, Einstellungen | alle | `src/components/app/app-shell.tsx` | [1](01-ueberblick.md#die-oberfläche) |
| Befehlspalette | alle | „Suchen und Befehle“, ⌘K / Strg+K; `src/components/app/command-palette.tsx` | [1](01-ueberblick.md#schneller-ans-ziel) |
| Hell, Wie System, Dunkel | alle, ab Tablet-Breite | Seitenleiste unten; `src/components/app/theme.tsx` | [4](04-darstellung.md#hell-und-dunkel) |
| Workspace wechseln | Mitglied mehrerer Workspaces | Workspace-Name oben → „Workspaces“ | [11](11-workspaces.md#wechseln) |

## Formulare bauen

| Funktion | Rolle oder Voraussetzung | Fundstelle | Handbuch |
|---|---|---|---|
| Formularliste mit Suche, Aktiv/Archiv/Papierkorb | ab L; Papierkorb ab A | `/` „Formulare“; `src/components/forms/forms-list.tsx` | [1](01-ueberblick.md#die-formularliste) |
| Leeres Formular | ab B | „Neues Formular → Leeres Formular“ | [2](02-formulare-erstellen.md#leeres-formular) |
| Zehn Vorlagen mit Vorschau | ansehen alle, verwenden ab B | `/vorlagen` → „Vorlage verwenden“; `src/lib/templates/index.ts` | [2](02-formulare-erstellen.md#aus-einer-vorlage), [0](00-erste-schritte.md#teil-a--formular-bereitstellen) |
| Formular aus Beschreibung, eingebauter Generator | ab B | „Aus Beschreibung …“ → „Entwurf prüfen“; `src/lib/forms/generate.ts` | [2](02-formulare-erstellen.md#aus-einer-beschreibung), [9](09-kanzleiablaeufe.md#formular-aus-einer-beschreibung-erzeugen-mit-oder-ohne-ki) |
| **Optional:** KI für „Aus Beschreibung“ | `AI_BASE_URL`, `AI_MODEL` (OpenAI-kompatibel) | `src/server/ai/generate.ts` | [9](09-kanzleiablaeufe.md#formular-aus-einer-beschreibung-erzeugen-mit-oder-ohne-ki), [21](21-konfiguration.md#ki-unterstützung-optional) |
| Duplizieren, Pausieren, Archivieren, Papierkorb (30 Tage) | ab B; Papierkorb ab A | Zeilenmenü / Rechtsklick in der Liste; Reiter Teilen → Status | [1](01-ueberblick.md#der-weg-eines-formulars), [5](05-veroeffentlichen-teilen.md#status-pausieren-archivieren-wieder-öffnen) |
| Editor: Felder einfügen (Klick, Ziehen, `/`), 30 Feldtypen | ab B | `/formulare/[id]/bearbeiten`; `src/components/builder/`, `src/lib/forms/fields.ts` | [2](02-formulare-erstellen.md#felder-einfügen), [2](02-formulare-erstellen.md#feldtypen) |
| Feld bearbeiten, Feldtyp ändern, technischer Schlüssel | ab B | rechte Spalte „Feld“ | [2](02-formulare-erstellen.md#ein-feld-bearbeiten) |
| Datei-Upload-Feld mit Inhaltsprüfung | ab B; Obergrenze `UPLOAD_MAX_MB` | `src/server/files/upload.ts` | [2](02-formulare-erstellen.md#datei-upload) |
| Unterschrift (einfache elektronische Signatur) | ab B | `src/components/form/signature-pad.tsx` | [2](02-formulare-erstellen.md#unterschrift), [2](02-formulare-erstellen.md#beispiel-vollmacht-mit-unterschrift) |
| Wiederholgruppe, verstecktes Feld, Wert aus dem Link | ab B | Editor; `src/server/prefill/service.ts` | [2](02-formulare-erstellen.md#wiederholgruppe), [5](05-veroeffentlichen-teilen.md#werte-über-den-link-übergeben) |
| Prüfungen und eigene Fehlermeldungen | ab B | Feld → „Prüfung“; `src/lib/forms/validate.ts` | [2](02-formulare-erstellen.md#prüfungen-und-fehlermeldungen) |
| Seiten, Bausteine | ab B | „Seite anfügen“, „Als Baustein speichern“ | [2](02-formulare-erstellen.md#seiten), [2](02-formulare-erstellen.md#bausteine) |
| Autosave mit Konfliktschutz, Rückgängig, Versionen | ab B | Speicheranzeige oben; „Versionen“ | [2](02-formulare-erstellen.md#speichern-und-versionen) |
| Bedingte Logik, Platzhalter, Abschlussseiten, Berechnungen | ab B | rechte Spalte „Regeln“, „Abschluss“; `src/lib/forms/logic.ts`, `src/lib/forms/expr.ts` | [3](03-logik.md) |
| Darstellung Classic/Cards/Wizard, Design, Vorschau | ab B | rechte Spalte „Design“, „Vorschau“ | [4](04-darstellung.md) |
| Veröffentlichen mit Vorabprüfung | ab B | „Veröffentlichen“; `src/lib/forms/analyze.ts` | [2](02-formulare-erstellen.md#veröffentlichen), [5](05-veroeffentlichen-teilen.md#veröffentlichen-und-versionen) |

## Teilen und öffentliche Formulare

| Funktion | Rolle oder Voraussetzung | Fundstelle | Handbuch |
|---|---|---|---|
| Link, Adresse anpassen | ansehen ab L, ändern ab B | Reiter Teilen → „Link“ | [5](05-veroeffentlichen-teilen.md#öffentliche-adresse-und-eigene-domain) |
| **Optional:** eigene Domain nur für Formulare | `PUBLIC_URL`, Reverse Proxy | `src/proxy.ts` | [5](05-veroeffentlichen-teilen.md#zwei-adressen-formulare-öffentlich-verwaltung-intern), [22](22-reverse-proxy.md) |
| QR-Code (SVG, PNG) | ab L | Teilen → „QR-Code“; `src/app/api/forms/[id]/qr/route.ts` | [5](05-veroeffentlichen-teilen.md#qr-code) |
| In Website einbetten | `EMBED_ORIGINS` | Teilen → „In Website einbetten“; `public/embed.js` | [5](05-veroeffentlichen-teilen.md#in-website-einbetten) |
| Passwortschutz, Zeitraum, Höchstzahl | ab B | Teilen → „Zugang“ | [5](05-veroeffentlichen-teilen.md#zugang-passwort-zeitraum-und-limit) |
| E-Mail bei neuer Antwort | ab B; `SMTP_URL` | Teilen → „Benachrichtigung“ | [5](05-veroeffentlichen-teilen.md#e-mail-bei-neuer-antwort) |
| Aufbewahrung je Formular | ab B | Teilen → „Aufbewahrung“ | [5](05-veroeffentlichen-teilen.md#aufbewahrung), [12](12-datenschutz-aufbewahrung.md#aufbewahrungsfristen-einstellen) |
| Formular ausfüllen und absenden, Zusammenfassung | veröffentlicht und offen | `/f/[slug]`; `src/app/f/[slug]/public-form.tsx` | [0](00-erste-schritte.md#teil-b--die-anfrage-bearbeiten), [5](05-veroeffentlichen-teilen.md#nach-dem-absenden) |
| Spam-Schutz | – | `src/app/api/public/forms/[slug]/submit/route.ts` | [5](05-veroeffentlichen-teilen.md#spam-schutz) |
| Später fortsetzen (Link, optional per E-Mail) | Design-Option; E-Mail nur mit SMTP | „Später fortsetzen“, `/r/[token]` | [5](05-veroeffentlichen-teilen.md#später-fortsetzen) |
| Folgeformular senden | ab L | Antwort → „Folgeformular senden“ | [5](05-veroeffentlichen-teilen.md#folgeformular-senden) |

## Antworten, Export und PDF

| Funktion | Rolle oder Voraussetzung | Fundstelle | Handbuch |
|---|---|---|---|
| Antworttabelle mit Spaltenauswahl, Tastatur | ab L | Reiter Antworten → „Spalten“; `src/components/responses/responses-view.tsx` | [6](06-antworten.md#die-tabelle), [0](00-erste-schritte.md#teil-b--die-anfrage-bearbeiten) |
| Suchen, filtern, sortieren, gespeicherte Ansichten | ab L; Ansichten teilen ab P | „Antworten durchsuchen“, „Filter“, „+ Ansicht speichern“ | [6](06-antworten.md#suchen-filtern-sortieren), [6](06-antworten.md#gespeicherte-ansichten) |
| Detailansicht mit Verlauf | ab L | „Antwort #n“; `src/components/responses/response-split.tsx` | [6](06-antworten.md#die-detailansicht), [9](09-kanzleiablaeufe.md#ergebnis-prüfen) |
| Status, Tags, Stern, interne Notizen | ab P | Statusmenü (Tasten 1–6), „Tag hinzufügen …“, „Notiz speichern“ | [6](06-antworten.md#status), [6](06-antworten.md#interne-notizen) |
| Dateien: Quarantäne, „Jetzt prüfen“, „Ungeprüft freigeben …“ | Buttons ab B | Antwort → Unterlagen; `src/server/actions/submissions.ts` | [6](06-antworten.md#dateien-und-unterschriften), [0](00-erste-schritte.md#teil-b--die-anfrage-bearbeiten) |
| **Optional:** Virenprüfung mit ClamAV | `CLAMAV_HOST`, Profil `clamav` | `src/server/files/scan.ts` | [20](20-installation.md#mit-virenscanner) |
| Sammelaktionen | Status/Tag ab P, Export ab B, Löschen ab A | Auswahl in der Tabelle | [6](06-antworten.md#sammelaktionen) |
| Antworten endgültig löschen | ab A | „⋯ → Endgültig löschen …“ | [6](06-antworten.md#antworten-löschen) |
| Auswertung: Aufrufe, Trichter, Antworten pro Tag | ab L | Reiter Auswertung; `src/components/share/analytics-view.tsx` | [6](06-antworten.md#auswertung) |
| Export XLSX, CSV, JSON | ab B | Antworten → „Export“; `src/app/api/forms/[id]/export/route.ts` | [7](07-export-pdf.md#export) |
| PDF je Antwort | ab L | „Daten / PDF“, „⋯ → PDF herunterladen“; `src/server/pdf/` | [7](07-export-pdf.md#pdf-je-antwort), [0](00-erste-schritte.md#teil-b--die-anfrage-bearbeiten) |
| PDF-Vorlagen | bearbeiten ab B | Reiter PDF-Vorlage | [7](07-export-pdf.md#pdf-vorlage) |

## Automationen, Freigaben und Schnittstellen

| Funktion | Rolle oder Voraussetzung | Fundstelle | Handbuch |
|---|---|---|---|
| Automationen mit Auslösern, Bedingungen, Schritten | ab B; Worker läuft | Reiter Automationen; `src/server/workflows/` | [8](08-automationen.md#automation-anlegen) |
| Schritte E-Mail und Bestätigung | `SMTP_URL`, `MAIL_FROM` | `src/server/mail/mailer.ts` | [8](08-automationen.md#e-mail-senden), [21](21-konfiguration.md#e-mail) |
| Schritt Webhook (signiert, mit Wiederholung) | Ziele im LAN nur mit `WEBHOOK_ALLOW_PRIVATE=true` | `src/server/webhooks/sign.ts`, `src/server/lib/safefetch.ts` | [8](08-automationen.md#webhook-auslösen), [Integrationen](integrationen.md#webhooks) |
| Schritte Status, Freigabe, PDF | ab B | Reiter Automationen | [8](08-automationen.md#schritte) |
| Testlauf, Protokoll, erneut ausführen | ansehen ab L, ausführen ab B | „Mit letzter Antwort testen“, „Protokoll“ | [8](08-automationen.md#testlauf), [8](08-automationen.md#protokoll) |
| Fehlgeschlagene Zustellungen erneut versuchen | ab B | roter Hinweis in Formularliste und Reiter | [8](08-automationen.md#fehlgeschlagene-zustellungen-erneut-versuchen) |
| Freigaben entscheiden | ab P und Zielrolle | `/freigaben`: „Freigeben“, „Ablehnen“ | [8](08-automationen.md#freigaben), [9](09-kanzleiablaeufe.md#vier-augen-prinzip-mit-freigaben) |
| REST-API v1 mit OpenAPI-Beschreibung | API-Schlüssel (ab A) | `/api/v1/…`, `/api/v1/openapi.json`; `src/app/api/v1/` | [Integrationen](integrationen.md#rest-api) |
| API-Schlüssel, Webhook-Geheimnis | ab A | Einstellungen → API und Webhooks | [Integrationen](integrationen.md#schlüssel-anlegen), [Integrationen](integrationen.md#das-webhook-geheimnis) |
| Übergabe an j-lawyer (Beispiel) | Empfangsdienst im LAN | Webhook + REST-API | [Integrationen](integrationen.md#beispiel-mandantenaufnahme-an-j-lawyer-im-lan) |

## Team, Workspaces und Datenschutz

| Funktion | Rolle oder Voraussetzung | Fundstelle | Handbuch |
|---|---|---|---|
| Mitglieder, Rollen ändern, entfernen | Liste alle, ändern ab A | Einstellungen → Team; `src/components/settings/team.tsx` | [10](10-team-rollen.md#mitglieder-verwalten) |
| Personen einladen (Link oder E-Mail) | ab A; E-Mail nur mit SMTP | „Person einladen“ | [10](10-team-rollen.md#personen-einladen), [0](00-erste-schritte.md#der-allererste-start) |
| Inhaberschaft übertragen, Workspace verlassen | I bzw. alle außer letztem Inhaber | Team → „⋯“ | [10](10-team-rollen.md#inhaberschaft-übertragen), [10](10-team-rollen.md#workspace-verlassen) |
| Neuer Workspace | nur Inhaber der Installation | Workspace-Menü → „Neuer Workspace“ | [11](11-workspaces.md#neuen-workspace-anlegen) |
| Workspace-Einstellungen, Datenexport (JSON) | ab A | Einstellungen → Workspace | [11](11-workspaces.md#einstellungen-des-workspace) |
| Workspace löschen | nur I, weiterer Workspace nötig | Einstellungen → Workspace | [11](11-workspaces.md#workspace-löschen) |
| Protokoll (Audit-Log) | ab A | Einstellungen → Protokoll; `src/server/audit.ts` | [10](10-team-rollen.md#protokoll) |
| Aufbewahrungsfristen und automatisches Löschen | ab A (Workspace), ab B (Formular); Worker | `src/server/queue/retention.ts` | [12](12-datenschutz-aufbewahrung.md) |

## Betrieb

| Funktion | Rolle oder Voraussetzung | Fundstelle | Handbuch |
|---|---|---|---|
| Worker mit dauerhafter Warteschlange | Dienst `worker` | `src/worker/main.ts`, `src/server/queue/` | [8](08-automationen.md#zuverlässigkeit-worker-und-warteschlange), [25](25-betrieb-cli.md#worker) |
| Healthcheck `/healthz`, `plica health` | – | `src/app/healthz/route.ts` | [25](25-betrieb-cli.md#gesundheitsprüfung-healthz) |
| Sicherung, Prüfung, Wiederherstellung | Server-Shell | `plica backup`, `plica verify`, `plica restore`; `src/cli/backup.ts` | [23](23-sicherung.md) |
| Einrichtungscode anzeigen, Passwort zurücksetzen | Server-Shell | `plica setup-code`, `plica reset-password` | [25](25-betrieb-cli.md#kommandozeile-plica) |
| Updates und Rollback | Server-Shell | `git pull && scripts/install.sh` | [24](24-updates.md) |

← [Bekannte Einschränkungen](28-bekannte-einschraenkungen.md) · [Handbuch](README.md)
