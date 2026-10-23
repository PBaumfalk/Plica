# 4 · Darstellung: Classic, Cards, Wizard

Dasselbe Formular kann auf drei Arten erscheinen: alle Fragen auf einer Seite, eine Frage pro Bildschirm oder Schritt für Schritt. Sie wechseln den Modus jederzeit, ohne das Formular neu aufzubauen. Dazu kommen Farbe, Ecken, Schrift, Logo und einige Einstellungen zum Ablauf.

Alles in diesem Kapitel stellen Sie im Editor ein, die meisten Punkte im Reiter **Design** rechts.

## Die drei Darstellungsmodi

Den Modus wählen Sie oben in der Mitte des Editors (**Classic**, **Cards**, **Wizard**) oder im Reiter **Design** unter **Darstellung → Modus**. Das Blatt im Editor zeigt die Felder immer untereinander. Wie das Formular im gewählten Modus wirkt, sehen Sie in der [Vorschau](#vorschau).

| Modus | So sieht es aus | Geeignet für |
|---|---|---|
| **Classic** | Alle Fragen untereinander, Seiten als Abschnitte | kurze Formulare: Kontakt, Terminanfrage, Vollmacht |
| **Cards** | Eine Frage pro Bildschirm, große Schrift | Umfragen und Feedback |
| **Wizard** | Seiten als Schritte mit Fortschritt und Zusammenfassung | längere Aufnahmen: Mandantenaufnahme, Schadensmeldung |

### Classic

Die Person sieht das ganze Formular auf einer Seite. Mehrere Seiten erscheinen als Abschnitte mit ihrem Titel, getrennt durch eine Linie. Am Ende steht der Absende-Button.

Fehlt beim Absenden etwas, nennt das Formular die Zahl der fehlenden oder ungültigen Angaben, etwa „2 Angaben fehlen oder sind ungültig.“, und springt zur ersten betroffenen Frage.

Classic eignet sich, wenn die Person das Formular auf einen Blick überschauen soll und es nicht mehr als etwa zehn bis fünfzehn Fragen hat.

### Cards

Jede Frage erscheint allein auf dem Bildschirm, groß und mit einer Nummer davor. Überschriften und Infotexte sind eigene Karten, Trennlinien und versteckte Felder entfallen.

So bedienen Mandanten das Formular:

- **OK** oder **Enter** führt zur nächsten Frage. Ist die Antwort ungültig oder fehlt eine Pflichtangabe, bleibt das Formular bei der Frage und zeigt den Fehler.
- Bei Auswahlfragen wählen die Buchstabentasten **A**, **B**, **C** usw. eine Antwort. Bei Fragen mit genau einer Antwort geht es nach der Wahl automatisch weiter, auch nach einem Klick.
- Die Pfeile unten rechts oder **Alt+↑** und **Alt+↓** (Mac: **⌥↑**, **⌥↓**) blättern zurück und vor.
- Nach der letzten Frage erscheint „Bereit zum Absenden?“ mit dem Absende-Button.

Ein Balken oben zeigt den Fortschritt. Cards wirkt persönlich und eignet sich für kurze Befragungen, etwa nach Mandatsende. Für Formulare mit vielen zusammengehörigen Angaben wie einer Anschrift und Bankdaten ist Wizard meist angenehmer.

### Wizard

Jede Seite des Formulars wird zu einem Schritt. Oben zeigt eine Leiste alle Schritte mit ihren Titeln. Auf dem Smartphone steht dort „Schritt 2 von 5“. Ohne Seitentitel heißen die Schritte „Schritt 1“, „Schritt 2“ usw. Geben Sie den Seiten deshalb kurze Titel wie „Über Sie“, „Ihr Anliegen“, „Unterlagen“.

- **Weiter** prüft die Angaben der aktuellen Seite und führt zur nächsten. **Zurück** führt eine Seite zurück.
- Ein Klick auf einen bereits erledigten Schritt in der Leiste springt dorthin zurück.
- Ist **Zusammenfassung vor dem Absenden** eingeschaltet, folgt nach der letzten Seite der Schritt „Überprüfen“. Unter „Alles richtig?“ sieht die Person alle Antworten, nach Seiten geordnet, und kann jede Seite über **Ändern** noch einmal öffnen.
- Auf dem letzten Schritt trägt der Button die Beschriftung, die Sie für den Absende-Button festgelegt haben.

Seiten, die eine Regel ausblendet oder überspringt, erscheinen weder in der Leiste noch in der Zusammenfassung (siehe [Kapitel 3](03-logik.md)).

Wizard ist der Modus der Vorlage „Mandantenaufnahme“: vier Schritte, Zusammenfassung vor dem Absenden und der Button „Anfrage verbindlich senden“.

## Einstellungen im Reiter Design

### Darstellung

- **Modus**: Classic, Cards oder Wizard (siehe oben).
- **Fortschritt anzeigen**: die Schrittleiste im Wizard bzw. den Balken bei Cards. Im Modus Classic hat die Einstellung keine Wirkung.
- **Zusammenfassung vor dem Absenden**: der Schritt „Überprüfen“. Nur im Wizard-Modus.
- **Später fortsetzen erlauben**: Unter dem Formular erscheint der Button **Später fortsetzen**. Er speichert den Zwischenstand verschlüsselt und zeigt einen privaten Link, mit dem die Person später weitermacht. Der Link gilt 30 Tage. Auf Wunsch schickt PLICA ihn an eine E-Mail-Adresse (**Link an mich senden**). Das lohnt sich bei langen Formularen, für die Mandanten Unterlagen heraussuchen müssen.
- **Beschriftung des Absende-Buttons**: voreingestellt „Absenden“. Ein konkreter Text sagt der Person, was passiert, etwa „Termin anfragen“, „Vollmacht erteilen“ oder „Verbindlich unterschreiben“. Bleibt das Feld leer, steht wieder „Absenden“ auf dem Button.
- **Sprache der Meldungen**: Deutsch oder Englisch. Die Einstellung betrifft die Fehlermeldungen der Prüfung, etwa bei einer ungültigen E-Mail-Adresse. Fragen, Hilfetexte und Abschlussseiten schreiben Sie selbst in der gewünschten Sprache. Schaltflächen wie „Weiter“ und „Zurück“ bleiben deutsch.

### Farbe

Die Akzentfarbe färbt Buttons, die Fortschrittsanzeige, gewählte Antworten und den Haken auf der Abschlussseite. Acht Farben stehen zur Wahl:

| Farbe | Farbwert |
|---|---|
| Petrol (Voreinstellung) | `#0b5c66` |
| Tinte | `#1f4e79` |
| Prüfgrün | `#2f6b1e` |
| Siegel | `#9b1c1c` |
| Bernstein | `#8f5800` |
| Aktenbraun | `#5a3e2b` |
| Graphit | `#3f4a47` |
| Schwarz | `#18201e` |

Für eine **eigene Farbe**, etwa die Hausfarbe der Kanzlei, klicken Sie auf das Farbfeld unter der Auswahl oder tragen den Farbwert daneben ein, zum Beispiel `#2f4a7a`.

Die Schriftfarbe auf Buttons wählt PLICA selbst: Auf einer hellen Akzentfarbe steht dunkle Schrift, auf einer dunklen weiße. Damit Texte gut lesbar bleiben, empfehlen sich trotzdem eher kräftige, dunkle Farben.

### Form

- **Ecken**: Eckig, Leicht, Mittel oder Rund. Das gilt für Eingabefelder, Buttons und Rahmen.
- **Schrift**: Grotesk (schlicht, serifenlos), Serif oder Mono (gleichmäßige Zeichenbreite wie auf der Schreibmaschine).
- **Logo**: **Logo hochladen** nimmt PNG, JPG, WebP oder GIF. Das Logo erscheint über dem Formulartitel. **Ersetzen** tauscht es aus, das Papierkorb-Symbol entfernt es.

## Hell und dunkel

Öffentliche Formulare folgen der Hell-/Dunkel-Einstellung auf dem Gerät der ausfüllenden Person. Im dunklen Modus hellt PLICA die Akzentfarbe auf, damit Text darauf lesbar bleibt. Sie müssen dafür nichts einstellen.

Für die Verwaltung wählen Sie die Darstellung selbst: unten in der Seitenleiste über die drei Symbole **Hell** (Sonne), **Wie System** (Bildschirm) und **Dunkel** (Mond), oder über ⌘K mit „Helles Design“ bzw. „Dunkles Design“.

## Vorschau

**Vorschau** oben rechts (oder **⌘⇧P**) öffnet das Formular so, wie Mandanten es sehen, mit allen Regeln, Prüfungen und Berechnungen.

- Oben wechseln Sie zwischen **Classic**, **Cards** und **Wizard** und zwischen Desktop- und Smartphone-Ansicht. Der Moduswechsel in der Vorschau ändert nichts am Formular. Er dient nur zum Vergleichen.
- **Neu starten** leert alle Eingaben und beginnt von vorn.
- In der Vorschau wird nichts gespeichert oder versendet. Automationen laufen nicht. Nach dem Absenden erscheint die passende Abschlussseite mit dem Hinweis „Vorschau – es wurde nichts gespeichert.“

Nutzen Sie die Vorschau, um jede Regel einmal durchzuspielen: zum Beispiel einmal als Privatperson und einmal als Unternehmen, einmal mit und einmal ohne laufende Frist.

Auch das Blatt im Editor zeigt Farbe, Ecken und Schrift bereits an. Mit dem Umschalter Desktop/Smartphone oben in der Mitte prüfen Sie, wie schmal das Formular auf einem Handy wird.

← [Logik](03-logik.md) · weiter: [Veröffentlichen](05-veroeffentlichen-teilen.md) →
