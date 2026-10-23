# 12 · Datenschutz und Aufbewahrung

Dieses Kapitel beschreibt, wie lange PLICA Daten aufbewahrt, wann und wie es löscht und was es überhaupt speichert. Welche Pflichten die Kanzlei als Verantwortliche zusätzlich trifft (Löschkonzept, Verarbeitungsverzeichnis, Auftragsverarbeitung), steht in [Datenschutz](../datenschutz.md).

## Aufbewahrungsfristen einstellen

PLICA kennt zwei Ebenen:

| Ebene | Wo | Wer |
|---|---|---|
| **Workspace** (Standard) | **Einstellungen → Workspace → Allgemein**: **Antworten automatisch löschen** einschalten, **Aufbewahrung in Tagen** angeben | Administrator, Inhaber |
| **Formular** (abweichend) | Formular → **Teilen** → **Benachrichtigung und Aufbewahrung**: **Antworten automatisch löschen nach** … Tagen. Leer = Standard des Workspace | Bearbeiter und höher |

Erlaubt sind 1 bis 36 500 Tage. Die Frist des Formulars hat Vorrang vor der des Workspace. Ist keine von beiden gesetzt, löscht PLICA Antworten nicht automatisch.

Wichtig: **Die Frist wird beim Eingang festgelegt.** Jede neue Antwort erhält beim Absenden ein Löschdatum (Eingang + Frist). Ändern Sie später die Frist, gilt das nur für neue Antworten; vorhandene behalten ihr Datum oder bleiben ohne Löschdatum. Das Löschdatum einer Antwort sehen Sie in der Antwortansicht („wird am … gelöscht“).

Die Fristen selbst legt PLICA nicht fest. Bestimmen Sie sie fachlich, etwa nach Zweck des Formulars und den Aufbewahrungspflichten für Handakten (§ 50 BRAO).

## Was der Worker automatisch löscht

Der Worker führt einmal täglich eine Bereinigung aus, nachts um 01:30 UTC (02:30 Uhr Winterzeit, 03:30 Uhr Sommerzeit). Startet der Worker später am Tag, holt er den Lauf sofort nach. Die Bereinigung löscht **endgültig**, ohne Papierkorb:

| Was | Wann |
|---|---|
| Antworten mit abgelaufenem Löschdatum | beim ersten Lauf nach Ablauf, **einschließlich** hochgeladener Dateien und Unterschriften im Speicher |
| Formulare im Papierkorb | 30 Tage nach dem Löschen, mit allen Antworten und Dateien |
| Zwischenstände („Später fortsetzen“) | nach Ablauf des Fortsetzungslinks (30 Tage nach dem letzten Speichern) |
| Uploads, die nie abgesendet wurden | nach 24 Stunden – außer sie gehören zu einem noch gültigen Fortsetzungslink; dann erst nach dessen Ablauf |
| Dateien im Speicher ohne zugehörigen Datensatz (z. B. nach einem Absturz beim Hochladen) | nach 24 Stunden |
| abgelaufene Sitzungen | sobald abgelaufen |
| anonyme Ereignisse der Abbruchanalyse | nach 180 Tagen |
| erledigte Hintergrundaufträge | nach 30 Tagen |

Gelöschte Antworten erscheinen im Protokoll des Workspace mit ihrer Anzahl (Aktion `retention.submissions_deleted`).

Läuft der Worker nicht, wird auch nicht gelöscht. Prüfen Sie deshalb, dass der Container `worker` läuft (siehe [Betrieb und Kommandozeile](25-betrieb-cli.md)).

## Von Hand löschen

- **Einzelne Antworten** löschen Administratoren und Inhaber. Die Antwort und ihre Dateien sind sofort und endgültig weg; das Protokoll vermerkt Anzahl und Formular, nicht den Inhalt.
- **Formulare** löschen Administratoren und Inhaber. Sie liegen zunächst 30 Tage im Papierkorb und lassen sich dort zurückholen oder vorher endgültig löschen.
- **Ganze Workspaces** löscht nur der Inhaber (siehe [Workspaces](11-workspaces.md#workspace-löschen)).

## Sicherungen nicht vergessen

Gelöschte Daten stecken noch in älteren Sicherungen, bis diese rotiert werden. Standardmäßig behält PLICA die letzten 14 automatischen Sicherungen (`BACKUP_KEEP`). Für Kopien außerhalb des Servers gilt Ihre eigene Aufbewahrungsregel. Halten Sie beides in Ihrem Löschkonzept fest (siehe [Sicherung und Wiederherstellung](23-sicherung.md)).

## Was PLICA speichert

Zu jeder Antwort:

- die eingegebenen Werte und hochgeladenen Dateien,
- Eingangszeit und die **Formularversion**, auf die sich die Antwort bezieht,
- technische Angaben: Ausfülldauer, Sprache des Formulars, Browserkennung, ob das Formular eingebettet war und ob es aus einer anderen Antwort vorbelegt wurde.

PLICA speichert **keine IP-Adressen im Klartext** – weder bei Antworten noch bei der Anmeldung. Für Ratenbegrenzung und Missbrauchsschutz verwendet es nur einen an den Tag gebundenen Hash der Adresse.

Unterschriften speichert PLICA als Bild mit Zeitpunkt, SHA-256-Prüfsumme, Formularversion, Browserkennung und diesem gehashten Netzkennzeichen. Das ist eine einfache elektronische Signatur, keine fortgeschrittene oder qualifizierte (Einzelheiten in [Datenschutz](../datenschutz.md)).

Die **Abbruchanalyse** arbeitet mit anonymen Ereignissen ohne Cookies und ohne IP-Adresse.

Ohne Virenscanner bleiben Uploads in Quarantäne: Sie werden gespeichert, aber erst geöffnet, wenn eine berechtigte Person sie ausdrücklich freigibt (siehe [Installation](20-installation.md#mit-virenscanner)).

## Auskunft und Löschung auf Anfrage

Für Anfragen Betroffener nutzen Sie die Bordmittel:

- **Finden**: Volltextsuche in den Antworten eines Formulars (siehe [Antworten bearbeiten](06-antworten.md)).
- **Herausgeben**: Export als CSV, XLSX oder PDF (siehe [Export und PDF](07-export-pdf.md)).
- **Löschen**: die betreffenden Antworten von Hand löschen und an die Sicherungen denken.

← [Workspaces](11-workspaces.md) · weiter: [Installation](20-installation.md) →
