# 2 · Formulare erstellen

Dieses Kapitel zeigt, wie Sie ein Formular anlegen, Felder einfügen und einstellen, Seiten gliedern und den Entwurf sichern. Wie Felder auf Antworten reagieren und wie PLICA rechnet, steht in [Kapitel 3](03-logik.md). Farbe, Schrift und Darstellungsmodus behandelt [Kapitel 4](04-darstellung.md).

Zum Bauen brauchen Sie mindestens die Rolle **Bearbeiter**.

## Ein neues Formular anlegen

Auf der Startseite **Formulare** öffnet der Button **Neues Formular** ein Menü mit drei Wegen.

### Leeres Formular

**Leeres Formular** legt einen Entwurf mit dem Titel „Unbenanntes Formular“, einer leeren Seite und einer Abschlussseite „Vielen Dank!“ an und öffnet den Editor.

### Aus einer Vorlage

**Aus Vorlage** (oder **Vorlagen** in der Seitenleiste) zeigt zehn fertige Formulare. Links wählen Sie eine Vorlage, rechts sehen Sie eine Vorschau, die Sie probehalber ausfüllen können. **Vorlage verwenden** legt eine Kopie als Entwurf an. Die Vorlage selbst bleibt unverändert.

Die Vorlagen im Einzelnen:

- **Kontaktformular**: Name, E-Mail, Telefon, Betreff, Nachricht und Einwilligung.
- **Kundenanfrage**: Unternehmen, Ansprechpartner, Interessen, Budget und Zeitrahmen; die Herkunft der Anfrage kommt über den Link (`?quelle=…`).
- **Mandantenaufnahme** (Branchenvorlage für Kanzleien): Privatperson oder Unternehmen, Gegenseite, Sachverhalt, laufende Frist, Rechtsschutzversicherung, Unterlagen und Einwilligungen. Vier Schritte mit Zusammenfassung vor dem Absenden. Läuft eine Frist, erscheint eine eigene Abschlussseite mit dem Fristende.
- **Terminwunsch**: Wunsch- und Ausweichtermin (frühestens morgen, spätestens in 90 Tagen), Gesprächsart, Tageszeit. Die Frage nach barrierefreiem Zugang erscheint nur bei einem Termin vor Ort.
- **Einwilligungserklärung**: Einwilligung in Foto- und Videoaufnahmen mit Verwendungszwecken zum Ankreuzen, Ort und elektronischer Unterschrift.
- **Dokumentenupload**: Unterlagen mit Vorgangsnummer und Eingangsdatum hochladen.
- **Bewerbungsformular**: Stelle, Kontaktdaten, Eintrittsdatum, Lebenslauf als PDF und Nachweise in drei Schritten.
- **Veranstaltungsanmeldung**: Teilnahme vor Ort oder online, Begleitpersonen als Wiederholgruppe und automatisch berechneter Betrag.
- **Feedbackformular** und **Mehrstufiger Fragebogen**: Bewertungen, Matrix und Fragen, die je nach Antwort übersprungen werden.

### Aus einer Beschreibung

**Aus Beschreibung …** öffnet ein Textfeld. Sie nennen Zweck und Felder in einem Satz, zum Beispiel:

> Terminanfrage mit Name, E-Mail, Telefon, Wunschtermin, Gesprächsart (Kanzlei, Telefon, Video), Datenschutz

**Entwurf erzeugen** (oder ⌘ + Enter) erkennt daraus Feldtypen, Pflichtangaben und Auswahlmöglichkeiten. Unter **Entwurf prüfen** sehen Sie das Ergebnis als Vorschau. **Beschreibung ändern** führt zurück, **Formular anlegen und bearbeiten** übernimmt den Entwurf in den Editor.

PLICA nutzt dafür einen eingebauten Generator, der ohne KI direkt auf dem Server arbeitet. Hat die IT eine KI angebunden, steht über der Vorschau „Erzeugt mit der konfigurierten KI.“ In beiden Fällen ist das Ergebnis ein gewöhnlicher Entwurf, den Sie danach prüfen und anpassen.

### Ein bestehendes Formular kopieren

In der Formularliste wählen Sie bei einem Formular **Duplizieren**. PLICA legt eine Kopie des aktuellen Entwurfs mit dem Zusatz „(Kopie)“ im Titel an und öffnet sie im Editor. Antworten werden nicht mitkopiert.

## Der Editor im Überblick

Der Editor nutzt die ganze Bildschirmfläche. Er besteht aus vier Teilen.

**Die obere Leiste** enthält den Pfeil zurück zur Formularliste, den Titel des Formulars und die Speicheranzeige. In der Mitte schalten Sie den Darstellungsmodus (Classic, Cards, Wizard) und die Ansicht Desktop oder Smartphone um. Rechts folgen Rückgängig, Wiederholen, **Teilen**, **Antworten**, **Vorschau** und **Veröffentlichen**.

**Die linke Spalte** hat zwei Reiter. **Einfügen** listet alle Feldtypen nach Gruppen und darunter Ihre Bausteine. **Gliederung** zeigt alle Seiten und Felder als Liste. Ein Klick springt zum Feld. Ein Verzweigungssymbol markiert Felder und Seiten, die von Regeln abhängen. Ein Warndreieck markiert Stellen mit einem Hinweis.

**In der Mitte** liegt das Formular als Blatt, so wie es später aussieht. Mehrere Seiten erscheinen als mehrere Blätter. Zwischen zwei Blättern liegt der **Falz**, also der Seitenumbruch.

**Die rechte Spalte** zeigt die Eigenschaften in vier Reitern:

- **Feld**: Einstellungen des gewählten Feldes, der gewählten Seite oder, wenn nichts gewählt ist, des ganzen Formulars.
- **Regeln**: die bedingte Logik, siehe [Kapitel 3](03-logik.md). Die Zahl am Reiter nennt die Anzahl der Regeln. Sie wird rot, wenn eine Regel einen Fehler hat.
- **Abschluss**: die Seiten nach dem Absenden, siehe [Kapitel 3](03-logik.md#abschlussseiten).
- **Design**: Darstellung, Farbe und Form, siehe [Kapitel 4](04-darstellung.md).

Auf schmalen Bildschirmen sind beide Spalten ausgeblendet. Sie öffnen sie über das Plus-Symbol (**Feld einfügen**) und das Regler-Symbol (**Eigenschaften**) in der oberen Leiste.

## Titel und Einleitung

Klicken Sie auf dem ersten Blatt oben auf **Titel des Formulars** und darunter auf die Einleitung. Die Einleitung erscheint über dem ersten Feld. Nutzen Sie sie für zwei, drei Sätze dazu, wofür das Formular dient und was mit den Angaben geschieht, etwa: „In wenigen Schritten zu Ihrer Erstberatung. Ihre Angaben unterliegen der anwaltlichen Schweigepflicht.“

Dieselben Angaben finden Sie im Reiter **Feld**, wenn kein Feld ausgewählt ist, unter **Formular**. Dort zeigt PLICA auch, wie viele Seiten, Fragen und Regeln das Formular hat.

## Felder einfügen

Sie haben vier Möglichkeiten:

- **Klicken** Sie in der linken Spalte auf einen Feldtyp. Das Feld erscheint hinter dem gerade ausgewählten Feld, sonst am Ende der letzten Seite.
- **Ziehen** Sie einen Feldtyp auf das Blatt. Eine Linie zeigt, wo das Feld landet.
- **Drücken** Sie **/**. Es öffnet sich ein Suchfeld. Tippen Sie zum Beispiel „Datum“ oder „Unterschrift“ und bestätigen Sie mit Enter.
- **Häufig ergänzt**: Unter dem letzten Blatt schlägt PLICA passende Felder vor, etwa eine Datenschutz-Einwilligung, sobald das Formular personenbezogene Daten erfasst, oder einen Ort, sobald es eine Unterschrift enthält. Ein Klick fügt den Vorschlag ein.

Mit dem Suchfeld **Feldtyp suchen** über der Liste finden Sie Feldtypen auch über Stichworte, etwa „Anschrift“ für Adresse oder „DSGVO“ für Einwilligung.

## Feldtypen

| Gruppe | Feldtypen |
|---|---|
| Text | Kurzer Text, Langer Text |
| Kontakt | E-Mail, Telefon, Name, Adresse |
| Auswahl | Dropdown, Einfachauswahl, Mehrfachauswahl, Checkboxen, Ja / Nein, Matrix |
| Zahlen | Zahl, Betrag, Schieberegler, Bewertung |
| Datum und Zeit | Datum, Uhrzeit, Datum mit Uhrzeit, Zeitraum |
| Dateien und Unterschrift | Datei-Upload, Unterschrift |
| Fortgeschritten | Berechnung, Einwilligung, Wiederholgruppe, Verstecktes Feld |
| Gestaltung | Überschrift, Infotext, Trennlinie, Bild |

Felder der Gruppe **Gestaltung** nehmen keine Antwort entgegen. Sie gliedern und erklären.

Einige Feldtypen haben Voreinstellungen: **Name** und **E-Mail** sind von Anfang an Pflichtfelder. **Adresse** fragt Straße und Hausnummer, PLZ, Ort und Land ab, mit „Deutschland“ als vorbelegtem Land. **Betrag** rechnet in Euro mit zwei Nachkommastellen. **Datei-Upload** erlaubt eine Datei bis 10 MB als PDF, JPG oder PNG.

## Ein Feld bearbeiten

Klicken Sie ein Feld auf dem Blatt an. Rechts im Reiter **Feld** erscheinen seine Einstellungen, in Abschnitte gegliedert. Welche Abschnitte Sie sehen, hängt vom Feldtyp ab. Enter springt bei einem ausgewählten Feld direkt in die Frage.

### Inhalt

- **Frage**: der Text über dem Eingabefeld, zum Beispiel „Wann endet die Frist?“. Mit `{{schluessel}}` setzen Sie eine frühere Antwort ein, siehe [Kapitel 3](03-logik.md#antworten-in-texte-einsetzen).
- **Hilfetext**: ein Hinweis unter der Frage, etwa „Zum Beispiel aus einer Kündigung, einem Bescheid oder einem gerichtlichen Schreiben.“
- **Platzhalter**: grauer Beispieltext im leeren Eingabefeld, etwa „z. B. HRB 12345“. Ihn gibt es bei Textfeldern, Dropdown und Zahlenfeldern.

### Eingabe

- **Pflichtfeld**: Ohne Antwort lässt sich das Formular nicht absenden. Ein Feld kann auch nur unter einer Bedingung Pflicht werden, siehe [Kapitel 3](03-logik.md).
- **Breite**: **Ganze Zeile** oder **Halbe Zeile**. Zwei halbe Felder stehen nebeneinander, etwa E-Mail und Telefon. Auf dem Smartphone stehen sie untereinander.
- **Standardwert** bzw. **Vorauswahl**: Diese Antwort ist beim Öffnen schon eingetragen. Das geht bei Text-, Zahlen- und Datumsfeldern, bei Dropdown, Einfachauswahl, Mehrfachauswahl, Checkboxen und Ja / Nein.

### Feldtyp ändern

Oben im Reiter **Feld** steht der Feldtyp. Bei verwandten Typen ist er ein Auswahlfeld, und Sie wechseln ohne Neuanlage, zum Beispiel von Kurzer Text zu Langer Text oder von Dropdown zu Einfachauswahl. Verwandt sind:

- Kurzer Text, Langer Text, E-Mail, Telefon
- Dropdown, Einfachauswahl, Mehrfachauswahl, Checkboxen
- Zahl, Betrag, Schieberegler
- Datum, Datum mit Uhrzeit
- Überschrift, Infotext

### Technischer Schlüssel

Jedes Feld mit einer Antwort hat einen Schlüssel, zum Beispiel `fristende` oder `email`. PLICA nutzt ihn in Exporten, in Platzhaltern wie `{{fristende}}`, in Formeln und in der API. Sie finden ihn im zugeklappten Abschnitt **Technischer Schlüssel**.

Solange ein Formular noch nie veröffentlicht wurde, leitet PLICA den Schlüssel automatisch aus der Frage ab. Ändern Sie den Schlüssel selbst, passt PLICA Formeln und Platzhalter in diesem Formular an. Erlaubt sind Kleinbuchstaben, Ziffern und Unterstrich, am Anfang ein Buchstabe. **Aus der Frage ableiten** erzeugt einen Vorschlag.

Ändern Sie den Schlüssel eines veröffentlichten Formulars nur mit Bedacht. Automationen, Exporte und angebundene Programme außerhalb des Formulars können ihn verwenden.

## Antwortmöglichkeiten

Dropdown, Einfachauswahl, Mehrfachauswahl und Checkboxen haben den Abschnitt **Antworten**:

- Jede Zeile ist eine Option. Enter am Ende einer Zeile legt die nächste an. Über den Griff links ändern Sie die Reihenfolge.
- Fügen Sie eine Liste mit mehreren Zeilen ein, etwa aus Word, legt PLICA alle Optionen auf einmal an. Das ist praktisch für eine Liste von Rechtsgebieten.
- **„Sonstiges“ mit Freitext erlauben** ergänzt eine Option, bei der die Person selbst etwas eintippt.
- Bei Mehrfachauswahl und Checkboxen begrenzen **Mindestens** und **Höchstens**, wie viele Optionen gewählt werden müssen oder dürfen.
- **Gespeicherte Werte separat bearbeiten** trennt den angezeigten Text vom gespeicherten Wert. So zeigt das Formular „Unternehmen oder Organisation“, gespeichert und exportiert wird aber `unternehmen`. Benennen Sie einen gespeicherten Wert um, passt PLICA die Regeln an, die darauf prüfen.

Die Unterschiede der Auswahltypen: **Dropdown** spart Platz bei vielen Optionen. **Einfachauswahl** zeigt alle Optionen untereinander, genau eine ist wählbar. **Mehrfachauswahl** zeigt Optionen als Chips, **Checkboxen** als Liste zum Ankreuzen. **Ja / Nein** hat genau zwei Antworten.

## Besondere Feldtypen

### Name und Adresse

Unter **Bestandteile** wählen Sie, welche Teile abgefragt werden. Beim **Namen**: Anrede/Titel, Vorname, Zweiter Vorname, Nachname, Zusatz. Bei der **Adresse**: Straße und Hausnummer, Adresszusatz, PLZ, Ort, Bundesland, Land. **Vorbelegtes Land** setzt das Land im Voraus.

### Datei-Upload

Unter **Dateien** legen Sie die **Erlaubten Dateitypen** fest: PDF, JPG, PNG, WebP, HEIC (iPhone), Word (DOCX), ODT, Excel (XLSX), Text und CSV. Dazu kommen **Anzahl Dateien** (1 bis 20) und **Max. Größe (MB)** je Datei (bis 100 MB). PLICA prüft den Inhalt jeder Datei, nicht nur die Endung.

Für die Mandantenaufnahme empfiehlt sich PDF, JPG, PNG und HEIC, damit Mandanten Schreiben einfach mit dem Handy fotografieren können.

### Unterschrift

Die Person unterschreibt mit Finger, Stift oder Maus. PLICA speichert die Unterschrift mit Zeitstempel, Formularversion und Prüfsumme. Das ist eine einfache elektronische Unterschrift. Sie ersetzt keine qualifizierte elektronische Signatur nach eIDAS. Ob sie für ein bestimmtes Dokument genügt, prüfen Sie im Einzelfall.

### Einwilligung

Die Person setzt ein Häkchen unter einem Text. Den Text tragen Sie unter **Einwilligungstext** im Feld **Wortlaut** ein. Gespeichert wird die Zustimmung. Weil jede Antwort der Formularversion zugeordnet bleibt, mit der sie ausgefüllt wurde, lässt sich auch nach einer späteren Textänderung nachvollziehen, welchem Wortlaut die Person zugestimmt hat.

### Wiederholgruppe

Eine Wiederholgruppe fasst Felder zusammen, die die Person mehrfach ausfüllen kann, zum Beispiel weitere Beteiligte mit Name und Anschrift oder mehrere offene Rechnungen mit Datum und Betrag.

- Legen Sie eine Wiederholgruppe an und ziehen Sie Felder hinein. Oder markieren Sie mehrere Felder derselben Seite und drücken Sie **⌘G** (**In Gruppe zusammenfassen**).
- Unter **Wiederholung** legen Sie die **Bezeichnung eines Eintrags** fest, etwa „Beteiligte Person“, und wie viele Einträge **Mindestens** und **Höchstens** erlaubt sind (bis 50).
- **Gruppe auflösen** im Feldmenü macht aus der Gruppe wieder einzelne Felder.

Datei-Uploads, Unterschriften und weitere Gruppen sind in einer Wiederholgruppe nicht möglich. Felder innerhalb einer Gruppe lassen sich nicht einzeln über Regeln ein- oder ausblenden. Die ganze Gruppe dagegen schon.

### Verstecktes Feld

Ein verstecktes Feld sieht die ausfüllende Person nicht. Es übernimmt einen Wert aus dem Link. Unter **Wert aus dem Link** tragen Sie den **URL-Parameter** ein, etwa `quelle`. Der Link `…/f/mandantenaufnahme?quelle=newsletter` speichert dann „newsletter“ mit der Antwort. So sehen Sie später, über welchen Weg eine Anfrage kam. Ohne Parameter im Link bleibt das Feld leer.

### Matrix, Bewertung und Schieberegler

- **Matrix**: mehrere Aussagen (**Zeilen**) mit denselben Antworten (**Spalten**), etwa für eine Zufriedenheitsumfrage. **Mehrere Antworten pro Zeile** erlaubt mehr als ein Kreuz je Zeile.
- **Bewertung**: Höchstwert 3 bis 10, dargestellt als Sterne, Herzen oder Zahlen.
- **Schieberegler**: Unter **Skala** stellen Sie **Von**, **Bis** und **Schritt** ein, dazu Beschriftungen für das linke und rechte Ende.

### Berechnung

Ein Berechnungsfeld zeigt ein Ergebnis aus anderen Antworten, zum Beispiel eine Summe. Die Person kann es nicht ändern. Wie Formeln funktionieren, steht in [Kapitel 3](03-logik.md#berechnungen).

### Überschrift, Infotext, Trennlinie, Bild

- **Überschrift** gliedert eine Seite. Die **Größe** ist Groß, Mittel oder Klein.
- **Infotext** zeigt einen Absatz ohne Eingabe, etwa den Text einer Vollmacht oder eine Erklärung, welche Unterlagen gebraucht werden.
- **Trennlinie** hat keine Einstellungen.
- **Bild**: **Bild hochladen** nimmt PNG, JPG, WebP oder GIF bis 5 MB. Tragen Sie einen **Alternativtext** ein, der das Bild für Menschen mit Screenreader beschreibt. Ist das Bild nur Dekoration, lassen Sie ihn leer.

## Prüfungen und Fehlermeldungen

Im Abschnitt **Prüfung** legen Sie fest, welche Eingaben gültig sind. PLICA prüft sofort im Browser und beim Absenden noch einmal verbindlich auf dem Server. Formatfehler zeigt das Formular, sobald die Person das Feld verlässt. Leere Pflichtfelder meldet es erst beim Absenden bzw. beim Weiterblättern.

| Feldtyp | Mögliche Prüfungen |
|---|---|
| Kurzer und langer Text, Telefon | Min. Zeichen, Max. Zeichen, Format |
| E-Mail | Min. Zeichen, Max. Zeichen (die Adresse selbst prüft PLICA immer) |
| Zahl | Minimum, Maximum, Nachkommastellen |
| Betrag | Minimum, Maximum, Währung (EUR, CHF, USD, GBP) |
| Datum, Datum mit Uhrzeit, Zeitraum | Frühestens, Spätestens |

### Format

Das **Format** ist ein regulärer Ausdruck. Sie müssen ihn nicht selbst schreiben: Das Menü **Vorlage …** bietet fertige Formate mit passender Fehlermeldung:

- Postleitzahl (DE)
- IBAN
- Vorgangsnummer (2026-0042)
- Nur Buchstaben

Unter dem Ausdruck können Sie eine **Testeingabe** eintippen. PLICA zeigt sofort „passt“ oder „passt nicht“. Die **Meldung bei falschem Format** sieht die Person, wenn ihre Eingabe nicht passt.

### Frühestens und spätestens

Bei Datumsfeldern geben Sie ein festes Datum im Format JJJJ-MM-TT ein oder einen Abstand zum heutigen Tag:

| Eingabe | Bedeutung |
|---|---|
| `today` | heute |
| `+1d`, `+30d` | in einem Tag, in 30 Tagen |
| `+2m` | in zwei Monaten |
| `+1y`, `-18y` | in einem Jahr, vor 18 Jahren |

Beispiele: Ein Wunschtermin mit **Frühestens** `+1d` und **Spätestens** `+90d` lässt nur Tage ab morgen bis in drei Monaten zu. Ein Geburtsdatum mit **Spätestens** `-18y` verlangt Volljährigkeit. PLICA zeigt unter dem Feld, welchem Datum die Angabe heute entspricht.

### Eigene Fehlermeldungen

Im Abschnitt **Fehlermeldungen** ersetzen Sie die Standardtexte: **Wenn leer** erscheint bei einem leeren Pflichtfeld, **Wenn ungültig** bei einer ungültigen Eingabe. Schreiben Sie hier konkret, was fehlt, etwa „Bitte nennen Sie das Datum aus dem Bescheid.“

## Felder anordnen und bearbeiten

Ist ein Feld ausgewählt oder fahren Sie mit der Maus darüber, erscheint unten rechts am Feld eine kleine Werkzeugleiste: **Nach oben**, **Nach unten**, **Duplizieren**, **Löschen** und **Weitere Aktionen**. Dasselbe Menü öffnet auch ein Rechtsklick auf das Feld. Es enthält:

- **Duplizieren**
- **In Gruppe zusammenfassen** bzw. **Gruppe auflösen**
- **Bedingung festlegen …** (führt zum Abschnitt **Sichtbarkeit**, siehe [Kapitel 3](03-logik.md))
- **Als Pflichtfeld markieren** bzw. **Nicht mehr Pflicht**
- **Auf Seite N verschieben**, wenn das Formular mehrere Seiten hat
- **Löschen**

Zum Verschieben ziehen Sie ein Feld am Griff links an die neue Stelle, auch auf ein anderes Blatt oder in eine Wiederholgruppe.

Mit **⇧ und Klick** wählen Sie mehrere Felder aus. Rechts stehen dann **Duplizieren**, **Gruppieren**, **Alle Pflicht**, **Löschen** und **Als Baustein speichern**.

Löschen Sie ein Feld, verschwinden auch Regeln, die nur dieses Feld betrafen. PLICA meldet das, etwa „Feld und 1 Regel entfernt“, und bietet **Rückgängig** an.

## Seiten

Ein Formular kann aus mehreren Seiten bestehen. Im Modus Classic erscheinen sie als Abschnitte untereinander, im Wizard als einzelne Schritte (siehe [Kapitel 4](04-darstellung.md)).

- **Seite N anfügen** unter dem letzten Blatt legt eine neue Seite an.
- Jede Seite kann einen **Abschnittstitel** haben, etwa „Über Sie“ oder „Ihr Anliegen“. Klicken Sie dazu oben auf das Blatt.
- Das Menü mit den drei Punkten neben dem Seitentitel bietet **Seite nach oben**, **Seite nach unten**, **Neue Seite danach**, **Mit vorheriger Seite zusammenführen** und **Seite mit Feldern löschen**.
- Auf dem Falz zwischen zwei Blättern erscheint beim Darüberfahren **Umbruch entfernen**. Das führt beide Seiten zusammen.

Klicken Sie auf die Seitenbeschriftung, zeigt der Reiter **Feld** die Einstellungen der Seite: **Titel**, **Beschreibung**, **Seite als Baustein speichern** und ab der zweiten Seite **Seite nur zeigen, wenn …** (siehe [Kapitel 3](03-logik.md)).

## Bausteine

Bausteine sind gespeicherte Feldgruppen, die Sie in jedem Formular des Workspace wieder einfügen. Typische Bausteine in der Kanzlei sind „Anschrift mit Kontakt“ (Name, Adresse, E-Mail, Telefon) oder „Datenschutz und E-Mail-Kommunikation“ mit den abgestimmten Einwilligungstexten.

So legen Sie einen Baustein an:

1. Markieren Sie ein Feld oder mit ⇧ und Klick mehrere Felder. Für eine ganze Seite wählen Sie die Seite aus.
2. Klicken Sie im Reiter **Feld** auf **Als Baustein speichern** bzw. **Seite als Baustein speichern**.
3. Geben Sie einen **Namen** und auf Wunsch eine **Beschreibung (optional)** ein und klicken Sie **Speichern**.

Ihre Bausteine stehen danach in der linken Spalte unter **Bausteine** und in der Suche nach **/**. Beim Einfügen bekommt jedes Feld einen eigenen Schlüssel. Spätere Änderungen am eingefügten Feld wirken nicht auf den Baustein zurück. Über die drei Punkte am Baustein wählen Sie **Baustein löschen**.

## Speichern und Versionen

### Automatisch speichern

PLICA speichert jede Änderung nach kurzer Zeit selbst. Neben dem Titel zeigt die Anzeige den Stand: **Gespeichert**, **Ungespeichert**, **Speichert …**, **Nicht gespeichert** (etwa ohne Netz) oder **Konflikt**. **⌘S** speichert sofort.

Schließen Sie den Browser, bevor gespeichert ist, hebt PLICA die Änderungen lokal in diesem Browser auf. Beim nächsten Öffnen erscheint „Ungespeicherte Änderungen vom letzten Mal gefunden“ mit **Wiederherstellen** und **Verwerfen**.

### Wenn zwei Personen gleichzeitig arbeiten

Ändert jemand anderes denselben Entwurf, etwa eine Kollegin oder Sie selbst in einem zweiten Browser-Tab, überschreibt PLICA nichts unbemerkt. Es erscheint der Dialog „Jemand anderes hat das Formular geändert“ mit zwei Wegen:

- **Neu laden (andere Fassung übernehmen)** verwirft Ihre letzten, noch nicht gespeicherten Änderungen.
- **Meine Fassung behalten** speichert Ihren Stand über die andere Fassung.

### Rückgängig machen

**⌘Z** macht den letzten Schritt rückgängig, **⌘⇧Z** stellt ihn wieder her. Das gilt für alle Änderungen im Editor, auch für gelöschte Felder und Seiten.

### Frühere Versionen

Der kleine Pfeil rechts neben **Veröffentlichen** öffnet die Versionsliste. Jede Veröffentlichung ist eine Version mit Nummer, Zeitpunkt, Person und Zahl der Antworten. Die aktuell öffentliche Version trägt den Zusatz „live“. **Wiederherstellen** lädt eine frühere Version als Entwurf in den Editor. Öffentlich wird sie erst, wenn Sie wieder veröffentlichen.

## Veröffentlichen

Der Button oben rechts zeigt den Stand: **Veröffentlichen** (noch nie veröffentlicht), **Änderungen veröffentlichen** (der Entwurf weicht von der öffentlichen Version ab) oder **Veröffentlicht** (beides ist gleich).

Vor dem Veröffentlichen prüft PLICA das Formular:

- **Fehler** verhindern das Veröffentlichen, zum Beispiel ein Auswahlfeld ohne Antwortmöglichkeiten oder eine Regel, die auf ein gelöschtes Feld verweist. Die Zahl der Fehler steht am Button. Ein Klick öffnet die Liste „Vor dem Veröffentlichen beheben“. Ein Klick auf einen Eintrag springt zur betroffenen Stelle.
- **Hinweise** blockieren nicht, zum Beispiel „Keine Frage ist Pflicht – das Formular kann leer abgeschickt werden.“ PLICA zeigt sie einmal pro Sitzung vor dem Veröffentlichen. Sie wählen **Zurück zum Editor** oder **Trotzdem veröffentlichen**.

Nach dem Veröffentlichen erscheint „Dein Formular ist online“ mit Link, QR-Code, **Link kopieren** und **Öffnen**. Alles Weitere zum Teilen steht in [Kapitel 5](05-veroeffentlichen-teilen.md).

## Beispiel: Vollmacht mit Unterschrift

So bauen Sie ein kurzes Formular, mit dem jemand eine Vollmacht online erteilt, zum Beispiel für eine Kanzlei, ein Steuerbüro oder eine Hausverwaltung:

1. **Neues Formular → Leeres Formular**. Titel: „Vollmacht“. Einleitung: „Bitte prüfen Sie Ihre Angaben und unterschreiben Sie am Ende.“
2. Fügen Sie **Name** ein. Unter **Bestandteile** wählen Sie zusätzlich Anrede/Titel.
3. Fügen Sie **Adresse** und **Geburtsdatum** (Feldtyp Datum) ein. Beim Geburtsdatum setzen Sie **Spätestens** auf `-18y` und **Wenn ungültig** auf „Die Vollmacht kann nur eine volljährige Person erteilen.“
4. Fügen Sie einen kurzen Text (Kurzer Text) „Vorgangsnummer“ ein und wählen Sie unter **Format** die Vorlage „Vorgangsnummer (2026-0042)“, oder schreiben Sie ein eigenes Format für Ihre Nummern. Ist die Nummer bekannt, können Sie sie stattdessen als verstecktes Feld aus dem Link übernehmen.
5. Fügen Sie einen **Infotext** mit dem Wortlaut der Vollmacht ein.
6. Fügen Sie eine **Einwilligung** ein, Wortlaut etwa „Ich erteile die Vollmacht im oben beschriebenen Umfang.“
7. Fügen Sie **Ort** (Kurzer Text, Pflicht, halbe Zeile) und **Unterschrift** (Pflicht) ein.
8. Im Reiter **Design** ändern Sie die **Beschriftung des Absende-Buttons** in „Vollmacht erteilen“ ([Kapitel 4](04-darstellung.md)).
9. Prüfen Sie alles mit **Vorschau** und klicken Sie **Veröffentlichen**.

Die PDF-Fassung jeder unterschriebenen Vollmacht legen Sie wie in [Kapitel 7](07-export-pdf.md) beschrieben ab.

## Tastenkürzel im Editor

Unter Windows und Linux gilt **Strg** statt **⌘** und **Alt** statt **⌥**. Die Taste **?** zeigt die Liste auch im Editor.

| Taste | Wirkung |
|---|---|
| / | Feld einfügen |
| ↑ ↓ | vorheriges / nächstes Feld auswählen |
| ⌥↑ ⌥↓ | ausgewähltes Feld verschieben |
| Enter | Frage des ausgewählten Feldes bearbeiten |
| ⇧ + Klick | mehrere Felder auswählen |
| ⌘D | duplizieren |
| ⌘G | in Wiederholgruppe zusammenfassen |
| ⌫ | löschen |
| ⌘Z / ⌘⇧Z | rückgängig / wiederholen |
| ⌘S | sofort speichern |
| ⌘⇧P | Vorschau |
| ⌘K | Befehle und Suche |
| Esc | Auswahl aufheben |

← [Überblick](01-ueberblick.md) · weiter: [Logik](03-logik.md) →
