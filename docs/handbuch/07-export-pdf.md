# 7 · Export und PDF

Antworten verlassen PLICA auf drei Wegen: als **Export** für die Tabellenkalkulation, als **PDF** je Antwort und über die [REST-API](integrationen.md) für andere Systeme. Dieses Kapitel behandelt die ersten beiden.

## Export

### Export starten

Im Reiter **Antworten** öffnen Sie oben rechts das Menü **Export**. Es nennt die Zahl der Antworten, die exportiert werden („12 Antworten mit aktuellen Filtern“), und bietet drei Formate:

- **Excel (XLSX)**
- **CSV für Excel** (in der Leiste für ausgewählte Antworten heißt derselbe Export nur **CSV**)
- **JSON**

Exportiert werden genau die Antworten der aktuellen Liste: Suche, Status, Tags, Zeitraum, Frage-Filter und Markierung wirken mit, die Seitenaufteilung nicht. Spam ist wie in der Liste nur enthalten, wenn Sie danach filtern.

Wollen Sie nur einzelne Antworten exportieren, wählen Sie sie in der Tabelle aus und nutzen **Export** in der Leiste der [Sammelaktionen](06-antworten.md#sammelaktionen).

Ohne eigene Sortierung erscheinen die Antworten nach Nummer aufsteigend. Haben Sie im Filter eine Sortierung gewählt, gilt diese.

Exportieren dürfen Bearbeiter, Administratoren und Inhaber. Jeder Export wird im Protokoll des Workspace mit Format, Filtern und Zahl der ausgewählten Antworten vermerkt.

### Spalten

Jede Datei beginnt mit sieben festen Spalten: **Nummer**, **Antwort-ID**, **Eingang**, **Status**, **Version**, **Tags**, **Markiert**.

Danach folgt je Formularfeld eine Spalte, und zwar über **alle Versionen** des Formulars: zuerst die Felder der neuesten Version in deren Reihenfolge und mit deren Beschriftung, dann Felder, die es nur in älteren Versionen gab. Jede Antwort wird mit den Felddefinitionen ihrer eigenen Version formatiert.

Nicht enthalten sind interne Notizen, der Verlauf und die Dateien selbst; bei Datei-Feldern steht der Dateiname. Dateien laden Sie in der Detailansicht oder über die API.

### Formate im Vergleich

| | CSV für Excel | Excel (XLSX) | JSON |
|---|---|---|---|
| Gedacht für | schnelle Weiterverarbeitung, Import | Auswertung in Excel oder LibreOffice | Programme, Skripte |
| Zeichensatz | UTF-8 mit BOM, Trennzeichen Semikolon | – | UTF-8 |
| Werte | lesbarer Text wie in der Oberfläche | Zahlen, Beträge (€) und Daten als echte Zahl- bzw. Datumszellen | Rohwerte nach Feldschlüssel |
| Eingang | Text in deutscher Zeit | Datumszelle in deutscher Zeit | ISO-Zeitpunkt in UTC |
| Status | deutsch (Neu, Erledigt …) | deutsch | englischer Code (`new`, `done` …) |
| Besonderheiten | – | fixierte Kopfzeile mit Autofilter | ein Objekt je Antwort mit `id`, `number`, `submittedAt`, `status`, `version`, `tags`, `starred`, `answers` |

Der Dateiname setzt sich aus Formulartitel und Datum zusammen, z. B. `mandantenaufnahme-antworten-2026-10-23.xlsx`.

### Schutz vor Formeln

Angaben aus öffentlichen Formularen sind nicht vertrauenswürdig. Ein Mandant könnte in ein Textfeld `=HYPERLINK(…)` schreiben. In der **CSV-Datei** stellt PLICA deshalb jedem Wert, der mit `=`, `+`, `-`, `@`, Tabulator oder Zeilenumbruch beginnt, ein Hochkomma voran, damit das Tabellenprogramm ihn als Text behandelt. Ausgenommen sind reine Zahlen wie `-12,50` und Telefonnummern wie `+49 2273 123456`.

In der **XLSX-Datei** schreibt PLICA Angaben immer als Text-, Zahl- oder Datumszellen, nie als Formel.

## PDF je Antwort

Jede Antwort lässt sich als PDF ansehen und herunterladen:

- In der Detailansicht schaltet **PDF** (Taste <kbd>p</kbd>) die Vorschau ein, **Daten** zurück.
- **⋯ → PDF herunterladen** speichert die Datei, z. B. `mandantenaufnahme-antwort-17.pdf`. Jeder Download wird im Protokoll vermerkt, das bloße Ansehen nicht.

PDFs erzeugt PLICA außerdem für E-Mail-Anhänge und den Schritt „PDF erzeugen“ in [Automationen](08-automationen.md) sowie über die [API](integrationen.md#dateien-und-pdfs).

### Das eingebaute Layout

Ohne eigene Vorlage enthält das PDF (DIN A4):

- auf jeder Seite oben „Antwort #Nummer“ und den Namen des Workspace, rechts die Eingangszeit,
- Formulartitel, Version, Status und Antwort-ID,
- alle Angaben in Formularreihenfolge, bei mehreren Seiten nach Seiten gegliedert; Gruppen und Matrixfragen übersichtlich aufbereitet, bei Datei-Feldern Dateiname und Größe,
- Unterschriften als Bild mit Zeitpunkt und SHA-256-Prüfsumme,
- auf jeder Seite unten Formulartitel, Antwortnummer und Version, „Seite x von y“ sowie Antwort-ID und eine **SHA-256-Prüfsumme der Antwortdaten**.

Die Prüfsumme der Antwortdaten hilft beim Nachweis: Gleiche Daten ergeben immer dieselbe Prüfsumme. Ein später erneut erzeugtes PDF derselben Antwort trägt also dieselbe Zahl.

Die Kennzeichnung „Antwort #17“ in der Kopfzeile steht in der Akzentfarbe Petrol (#0b5c66), derselben Farbe wie Knöpfe und Links in den E-Mails von PLICA. Ansonsten ist das PDF schwarz-grau gehalten und druckt sauber in Schwarzweiß.

## PDF-Vorlage

Im Reiter **PDF-Vorlage** gestalten Sie ein eigenes Dokument, etwa einen Aufnahmebogen für die Akte. Links bearbeiten Sie den Text, rechts sehen Sie sofort eine Vorschau – mit der neuesten Antwort des Formulars oder, solange es keine gibt, mit Beispieldaten. **Aktualisieren** erzeugt die Vorschau neu.

Bearbeiten dürfen Bearbeiter, Administratoren und Inhaber. Alle anderen sehen Vorlage und Vorschau nur.

### Vorlagen verwalten

- **Neue Vorlage** legt eine weitere Vorlage an. Ein Formular kann mehrere Vorlagen haben; sie erscheinen als Schaltflächen über dem Editor.
- **Standard für PDFs** macht eine Vorlage zur Standardvorlage. Es gibt höchstens eine; der Stern kennzeichnet sie.
- **Vorlage speichern** sichert Ihre Änderungen. „Nicht gespeichert“ zeigt ungesicherte Änderungen an.
- **Löschen** entfernt die gewählte Vorlage.

Die **Standardvorlage** gilt überall: für Download und Ansicht, E-Mail-Anhänge, den Schritt „PDF erzeugen“ und die API. Gibt es keine Standardvorlage – etwa nachdem Sie sie gelöscht haben –, nutzt PLICA das eingebaute Layout, bis Sie eine andere Vorlage als Standard markieren.

Kopf- und Fußzeile mit Antwortnummer, Seitenzahl, Antwort-ID und Prüfsumme setzt PLICA auch bei eigenen Vorlagen auf jede Seite.

### Gestaltung

Die Vorlage ist bewusst einfach gehalten, ohne HTML:

| Eingabe | Ergebnis |
|---|---|
| `# Titel`, `## Abschnitt`, `### Unterabschnitt` | Überschriften in drei Größen |
| `**fett**` | Fettdruck |
| `- Punkt` | Aufzählung |
| `---` | waagerechte Linie |
| Leerzeile | neuer Absatz |

### Platzhalter

Unter **Einfügen** setzen Sie Platzhalter mit einem Klick an die Cursorposition. Die Schaltflächen darunter fügen die Felder des Formulars ein.

| Platzhalter | Inhalt |
|---|---|
| `{{antworten}}` | alle Angaben wie im eingebauten Layout (auf eigener Zeile) |
| `{{nummer}}` | Antwortnummer |
| `{{eingang}}` | Eingangszeitpunkt, z. B. „23. Oktober 2026 um 09:12 Uhr“ |
| `{{datum}}` | Datum, an dem das PDF erzeugt wird |
| `{{formular}}` | Formulartitel |
| `{{id}}` | Antwort-ID |
| `{{feldschluessel}}` | Wert eines Feldes, z. B. `{{name}}` oder `{{anschrift}}` |
| `{{unterschrift:feldschluessel}}` | Unterschrift mit Nachweis an dieser Stelle (auf eigener Zeile) |

Unbekannte Platzhalter bleiben im PDF leer; der Editor warnt mit „Unbekannte Platzhalter bleiben im PDF leer“. Unterschriften, die Sie nicht platzieren, hängt PLICA am Ende an – keine Unterschrift geht verloren.

Antworten werden wörtlich eingesetzt. Schreibt jemand `**` oder `#` in ein Formularfeld, verändert das die Gestaltung nicht.

Beachten Sie: E-Mail-Texte in Automationen nutzen eigene Platzhalter mit dem Präfix `plica.` (z. B. `{{plica.nummer}}`), siehe [Kapitel 8](08-automationen.md#platzhalter-in-e-mails). Feldschlüssel wie `{{name}}` funktionieren in beiden.

### Beispiel: Aufnahmebogen für die Akte

```
# Mandantenaufnahme Nr. {{nummer}}

**Mandant:** {{name}}
**Anschrift:** {{anschrift}}
**Gegner:** {{gegner}}
**Rechtsgebiet:** {{rechtsgebiet}}

Eingegangen am {{eingang}}, gedruckt am {{datum}}.

---

## Alle Angaben

{{antworten}}

{{unterschrift:unterschrift}}
```

Die Feldschlüssel `name`, `anschrift`, `gegner`, `rechtsgebiet` und `unterschrift` sind Beispiele; verwenden Sie die Schlüssel Ihres Formulars.

← [Antworten](06-antworten.md) · weiter: [Automationen](08-automationen.md) →
