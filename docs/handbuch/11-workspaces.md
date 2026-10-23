# 11 · Workspaces

Ein Workspace ist ein abgeschlossener Bereich mit eigenen Formularen, Antworten, Dateien, Automationen, API-Schlüsseln, Mitgliedern und eigenem Protokoll. Was in einem Workspace liegt, ist in einem anderen nicht sichtbar. So lassen sich etwa Kanzlei und Verein oder zwei Abteilungen sauber trennen.

Eine Person kann Mitglied mehrerer Workspaces sein, in jedem mit einer eigenen Rolle (siehe [Team und Rollen](10-team-rollen.md)).

## Wechseln

Oben in der Seitenleiste steht der Name des aktuellen Workspace mit Ihrer Rolle. Ein Klick öffnet das Menü **Workspaces** mit allen Workspaces, in denen Sie Mitglied sind. Die Auswahl gilt für die aktuelle Sitzung.

Verlieren Sie den Zugriff auf den aktuellen Workspace (entfernt oder gelöscht), wechselt PLICA beim nächsten Seitenaufruf in einen anderen Ihrer Workspaces. Gehören Sie keinem mehr an, sehen Sie einen Hinweis mit der Möglichkeit, einen Einladungslink zu öffnen oder einen eigenen Workspace anzulegen.

## Neuen Workspace anlegen

Im Workspace-Menü **Neuer Workspace** wählen, einen Namen vergeben, bestätigen. Sie werden Inhaber des neuen Workspace und wechseln direkt hinein. Formulare, Antworten und Team beginnen leer.

Gut zu wissen:

- Jede angemeldete Person kann Workspaces anlegen, unabhängig von ihrer Rolle in anderen Workspaces.
- Eine Person kann höchstens 25 Workspaces als Inhaber besitzen.
- Formulare lassen sich nicht zwischen Workspaces verschieben.
- Bei Anmeldung über SSO hat der **älteste** Workspace eine Sonderrolle: Dort folgen die Rollen den authentik-Gruppen (siehe [Rollen bei Anmeldung über SSO](10-team-rollen.md#rollen-bei-anmeldung-über-sso)). Alle später angelegten Workspaces verwalten Sie ausschließlich über Einladungen.

## Einstellungen des Workspace

**Einstellungen → Workspace** steht Administratoren und Inhabern zur Verfügung.

**Allgemein.** Der **Name** erscheint in der Seitenleiste und in Einladungen. Mit **Antworten automatisch löschen** und **Aufbewahrung in Tagen** (1 bis 36 500) legen Sie die Standardfrist für alle Formulare ohne eigene Frist fest. Einzelheiten in [Datenschutz und Aufbewahrung](12-datenschutz-aufbewahrung.md).

**Daten exportieren.** **Export herunterladen** liefert eine JSON-Datei mit:

- allen Formularen und deren Versionen,
- allen Antworten mit Notizen und Bearbeitungsverlauf,
- den Metadaten der Dateien (Name, Typ, Größe, Prüfsumme, Prüfstatus),
- der Mitgliederliste mit Rollen.

Dateiinhalte (Uploads, Unterschriften, PDFs) sind **nicht** enthalten. Sie lassen sich je Antwort herunterladen oder über die [Sicherung](23-sicherung.md) wiederherstellen. Kennwörter geschützter Formulare erscheinen nur als „(gesetzt)“. Jeder Export steht im Protokoll.

**Deine Workspaces.** Liste Ihrer Workspaces mit Ihrer Rolle und der Schaltfläche **Neuer Workspace**.

## Workspace löschen

Nur der **Inhaber** sieht den Abschnitt **Workspace löschen**. Gelöscht werden endgültig alle Formulare, Antworten, Dateien im Speicher und Automationen des Workspace. Das lässt sich nicht rückgängig machen.

1. Vorher exportieren, was Sie behalten wollen.
2. **Einstellungen → Workspace → Workspace löschen**.
3. Zur Bestätigung den Namen des Workspace exakt eintippen.

Voraussetzung: Sie sind in mindestens einem weiteren Workspace Mitglied. Ihren einzigen Workspace können Sie nicht löschen – legen Sie zuerst einen anderen an. Andere Mitglieder werden beim nächsten Seitenaufruf in einen ihrer verbleibenden Workspaces umgeleitet.

Der Löschvorgang bleibt im Protokoll erhalten, ist aber keinem Workspace mehr zugeordnet. Bis die älteren Sicherungen rotiert sind, stecken die Daten noch in den Sicherungsdateien (siehe [Datenschutz und Aufbewahrung](12-datenschutz-aufbewahrung.md)).

## Protokoll

Jeder Workspace hat sein eigenes Protokoll unter **Einstellungen → Protokoll**. Was dort steht und was nicht, beschreibt [Team und Rollen](10-team-rollen.md#protokoll).

← [Team und Rollen](10-team-rollen.md) · weiter: [Datenschutz und Aufbewahrung](12-datenschutz-aufbewahrung.md) →
