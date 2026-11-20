# 3 · Bedingte Logik und Berechnungen

Mit Regeln passt sich ein Formular an die Antworten an. Eine Privatperson sieht keine Fragen zur Handelsregisternummer. Wer angibt, dass eine Frist läuft, wird nach dem Fristende gefragt und erhält am Ende einen anderen Hinweis. Mit Berechnungen zeigt das Formular Ergebnisse wie eine Summe oder ein Alter.

Dieses Kapitel erklärt Regeln, Abschlussseiten, Platzhalter und Formeln. Sie arbeiten dafür im Editor, den [Kapitel 2](02-formulare-erstellen.md) vorstellt.

## So ist eine Regel aufgebaut

Eine Regel liest sich wie ein Satz:

> **Wenn** [Feld] [Vergleich] [Wert], **dann** [Aktion] [Ziel].

Zum Beispiel:

- Wenn „Sie wenden sich an uns als“ ist „Unternehmen oder Organisation“, dann zeige „Name des Unternehmens“, „Rechtsform“ und „Handelsregisternummer“.
- Wenn „Läuft eine Frist?“ ist „Ja“, dann zeige „Wann endet die Frist?“ und zeige die Abschlussseite für Eilfälle.
- Wenn „Um welchen Betrag geht es ungefähr?“ ist größer als 50.000, dann wird „Was möchten Sie erreichen?“ Pflicht.

Genau diese Regeln enthält die Vorlage „Mandantenaufnahme“. Schauen Sie sie sich dort im Reiter **Regeln** an, bevor Sie eigene Regeln bauen.

## Eine Regel anlegen

Sie haben drei Wege. Alle führen in den Reiter **Regeln** rechts im Editor.

**Über das Feld.** Wählen Sie das Feld aus, das nur unter einer Bedingung erscheinen soll, etwa „Wann endet die Frist?“. Im Reiter **Feld** klicken Sie im Abschnitt **Sichtbarkeit** auf **Nur zeigen, wenn …**. PLICA legt eine Regel an und schlägt als Bedingung die nächstliegende vorherige Auswahl- oder Ja/Nein-Frage vor. Sie ändern sie im nächsten Schritt. Den gleichen Weg öffnet **Bedingung festlegen …** im Menü eines Feldes.

**Über die Seite.** Wählen Sie eine Seite ab der zweiten aus und klicken Sie **Seite nur zeigen, wenn …**.

**Direkt.** Im Reiter **Regeln** klicken Sie **Regel anlegen** (bei der ersten Regel) bzw. **Regel hinzufügen**.

Eine Regel braucht vorhandene Fragen. Ist das Formular noch leer, zeigt der Reiter „Lege zuerst Fragen an – Regeln reagieren auf Antworten.“

### Schritt 1: Bedingung wählen

Unter **Wenn** stellen Sie drei Dinge ein:

1. das **Feld**, auf dessen Antwort die Regel reagiert,
2. den **Vergleich**, etwa „ist“ oder „ist größer als“,
3. den **Wert**, etwa eine Antwortmöglichkeit, eine Zahl oder ein Datum. Bei „ist leer“ und „ist ausgefüllt“ entfällt der Wert.

Welche Vergleiche es gibt, hängt vom Feldtyp ab:

| Feldtyp | Vergleiche |
|---|---|
| Dropdown, Einfachauswahl | ist, ist nicht, ist eine von, ist keine von, ist ausgefüllt, ist leer |
| Mehrfachauswahl, Checkboxen | enthält, enthält nicht, enthält eine von, ist ausgefüllt, ist leer |
| Ja / Nein | ist („Ja“ oder „Nein“) |
| Einwilligung | ist („zugestimmt“ oder „nicht zugestimmt“) |
| Kurzer und langer Text, E-Mail, Telefon, verstecktes Feld | ist, ist nicht, enthält, enthält nicht, ist ausgefüllt, ist leer |
| Name, Adresse | enthält, enthält nicht, ist ausgefüllt, ist leer |
| Zahl, Betrag, Bewertung, Schieberegler, Berechnung | ist, ist nicht, ist größer als, ist mindestens, ist kleiner als, ist höchstens, ist ausgefüllt, ist leer |
| Datum, Datum mit Uhrzeit | ist am, ist nach dem, ist vor dem, ist frühestens am, ist spätestens am, ist ausgefüllt, ist leer |
| Uhrzeit, Zeitraum, Matrix | ist ausgefüllt, ist leer |

Bei „ist eine von“ kreuzen Sie mehrere Antworten an. So deckt eine Bedingung etwa „Arbeitsrecht“, „Mietrecht“ und „Familienrecht“ gemeinsam ab.

Textvergleiche achten nicht auf Groß- und Kleinschreibung. Zahlen dürfen Sie mit Tausenderpunkt und Komma eingeben, „50.000“ ist also 50000.

Nicht als Bedingung wählbar sind Datei-Uploads, Unterschriften, Wiederholgruppen und die Felder innerhalb einer Wiederholgruppe.

### Mehrere Bedingungen

**+ Bedingung** fügt eine weitere Bedingung hinzu. Darüber erscheint dann die Wahl zwischen **alle** und **eine**:

- **alle** zutreffen: Die Regel greift nur, wenn jede Bedingung erfüllt ist („und“).
- **eine** zutreffen: Es reicht, wenn eine Bedingung erfüllt ist („oder“).

Mit dem Kreuz an einer Bedingung entfernen Sie sie wieder.

### Schritt 2: Aktion wählen

Unter **Dann** wählen Sie, was passiert, und darunter das Ziel:

| Aktion | Wirkung |
|---|---|
| **Zeige Feld** | Das Feld erscheint nur, wenn die Regel greift. |
| **Verberge Feld** | Das Feld verschwindet, wenn die Regel greift. |
| **Mache zum Pflichtfeld** | Das Feld muss ausgefüllt werden, wenn die Regel greift. |
| **Zeige Seite** | Die Seite erscheint nur, wenn die Regel greift. |
| **Verberge Seite** | Die Seite entfällt, wenn die Regel greift. |
| **Springe zu Seite** | Die Seiten zwischen der Bedingung und dem Ziel entfallen. |
| **Zeige Abschlussseite** | Nach dem Absenden erscheint diese Abschlussseite statt der Standard-Abschlussseite. |

**+ Aktion** fügt weitere Aktionen hinzu. Eine Regel kann so mehrere Felder auf einmal zeigen.

Als Ziel von „Zeige Feld“ und „Verberge Feld“ eignen sich auch Infotexte und Überschriften, etwa ein Hinweis „Bitte bringen Sie den Bescheid zum Termin mit.“ Seiten-Aktionen sind erst wählbar, wenn das Formular mindestens zwei Seiten hat. Die erste Seite lässt sich nicht ein- oder ausblenden.

### Schritt 3: Prüfen und benennen

Unten auf jeder Regelkarte fasst PLICA die Regel in einem Satz zusammen, etwa: *Wenn „Läuft eine Frist?“ ist „Ja“, zeige „Wann endet die Frist?“, zeige Abschluss „Ihre Anfrage ist eingegangen – wir melden uns umgehend“.* Lesen Sie diesen Satz. Er zeigt am schnellsten, ob die Regel tut, was Sie meinen.

Oben auf der Karte können Sie der Regel einen Namen geben, etwa „Laufende Frist“. Ohne Namen heißt sie „Regel 1“, „Regel 2“ usw. Der Schalter daneben (**Regel aktiv**) setzt eine Regel vorübergehend außer Kraft, ohne sie zu löschen. Das Papierkorb-Symbol löscht sie.

Am Feld und in der Gliederung erkennen Sie geregelte Felder und Seiten an einem Verzweigungssymbol bzw. dem Zusatz „bedingt“. Im Abschnitt **Sichtbarkeit** eines Feldes stehen alle Regeln, die es betreffen. Ein Klick darauf öffnet die Regel.

## So wirken Regeln

Diese Grundsätze helfen, wenn eine Regel sich anders verhält als erwartet.

**„Zeige“ heißt: sonst verborgen.** Ein Feld oder eine Seite, auf die eine aktive „Zeige“-Regel zielt, ist zunächst verborgen. Es erscheint, sobald eine dieser Regeln greift. Haben Sie für ein Feld zwei „Zeige“-Regeln, genügt es, wenn eine greift.

**„Verberge“ hat Vorrang.** Greifen gleichzeitig eine „Zeige“- und eine „Verberge“-Regel für dasselbe Ziel, bleibt es verborgen.

**Verborgene Antworten zählen nicht.** Antwortet jemand auf eine Frage und ändert danach die Antwort, von der sie abhängt, verschwindet die Frage wieder. Ihre Antwort wird beim Absenden verworfen, auch wenn jemand sie technisch mitschickt. Ein verborgenes Pflichtfeld muss nicht ausgefüllt werden.

**Sprünge gehen nur nach vorn.** „Springe zu Seite“ lässt alle Seiten zwischen der Seite mit der Bedingung und der Zielseite aus. Rückwärts springen ist nicht möglich.

**Bei mehreren Abschlussseiten gewinnt die letzte.** Greifen mehrere Regeln mit „Zeige Abschlussseite“, gilt die Regel, die in der Liste weiter unten steht. Greift keine, erscheint die Standard-Abschlussseite.

**Der Server prüft mit.** PLICA wertet die Regeln im Browser sofort aus und beim Absenden noch einmal auf dem Server. Welche Felder Pflicht sind und welche Antworten gespeichert werden, entscheidet die Prüfung auf dem Server.

**Felder in Wiederholgruppen** lassen sich nicht einzeln steuern. Blenden Sie stattdessen die ganze Gruppe ein oder aus.

## Beispiele aus der Kanzlei

### Rechtsschutzversicherung nur bei Bedarf abfragen

Ein Ja/Nein-Feld „Haben Sie eine Rechtsschutzversicherung?“ und ein Textfeld „Versicherung und Versicherungsnummer“:

1. Wählen Sie „Versicherung und Versicherungsnummer“ aus und klicken Sie **Nur zeigen, wenn …**.
2. Bedingung: „Haben Sie eine Rechtsschutzversicherung?“ **ist** „Ja“.
3. Aktion: **Zeige Feld** „Versicherung und Versicherungsnummer“.

Soll die Versicherungsnummer in diesem Fall Pflicht sein, ergänzen Sie mit **+ Aktion** „Mache zum Pflichtfeld“ für dasselbe Feld. Alternativ setzen Sie das Feld selbst auf **Pflichtfeld**. Es ist dann nur Pflicht, solange es sichtbar ist.

### Barrierefreiheit nur bei Terminen vor Ort

In der Vorlage „Terminwunsch“ erscheint „Benötigen Sie einen barrierefreien Zugang?“ nur, wenn „Wie möchten Sie sprechen?“ **ist** „Vor Ort“.

### Seite für Unternehmen überspringen

Ein mehrseitiges Formular hat die Seiten „Über Sie“, „Unternehmensdaten“, „Ihr Anliegen“. Für Privatpersonen soll Seite 2 entfallen:

- Wählen Sie die Seite „Unternehmensdaten“ aus und klicken Sie **Seite nur zeigen, wenn …**.
- Bedingung: „Sie wenden sich an uns als“ **ist** „Unternehmen oder Organisation“.

Gleichwertig ist eine Regel auf Seite 1: Wenn „Sie wenden sich an uns als“ **ist** „Privatperson“, dann **Springe zu Seite** „Ihr Anliegen“.

### Eilfälle erkennen

1. Legen Sie im Reiter **Abschluss** eine zweite Abschlussseite an, etwa „Ihre Anfrage ist eingegangen – wir melden uns umgehend“ (siehe [Abschlussseiten](#abschlussseiten)).
2. Regel: Wenn „Läuft eine Frist?“ **ist** „Ja“, dann **Zeige Feld** „Wann endet die Frist?“ und **Zeige Abschlussseite** mit der Eil-Überschrift.

Wollen Sie zusätzlich das Sekretariat bei Eilfällen gesondert benachrichtigen, richten Sie das unter **Automationen** ein, siehe [Kapitel 8](08-automationen.md).

## Fehler früh erkennen

Der Editor prüft Regeln und Felder laufend. Probleme erscheinen direkt an der Regelkarte, am Feld und vor dem Veröffentlichen in einer Liste. PLICA unterscheidet zwei Stufen.

**Fehler** verhindern das Veröffentlichen. Dazu gehören:

- Verweise auf gelöschte Felder, Seiten oder Abschlussseiten,
- Regeln, die nie zutreffen können, etwa „größer als 10 **und** kleiner als 5“ oder zwei verschiedene Antworten derselben Einfachauswahl mit „alle“,
- Bedingungen auf eine Antwort, die das Feld gar nicht anbietet, etwa nach dem Umbenennen einer Option,
- Bedingungen auf Felder ohne Antwort, etwa auf eine Überschrift,
- Regeln, die ein Feld von sich selbst abhängig machen, oder Kreisläufe (A steuert B, B steuert A),
- eine Seite, die durch ihre eigene Bedingung ausgeblendet würde,
- zwei Regeln mit denselben Bedingungen, die dasselbe Element zeigen und verbergen,
- Sprünge zurück oder auf dieselbe Seite,
- Regeln, die die erste Seite ein- oder ausblenden,
- fehlerhafte Formeln oder Formeln mit unbekannten Feldern.

**Hinweise** blockieren nicht. Prüfen Sie sie trotzdem:

- eine Bedingung ohne Vergleichswert,
- ein Textfeld, das als Zahl verglichen wird,
- eine Regel, die ein Feld oder eine Seite anhand einer Antwort steuert, die erst später im Formular kommt,
- eine Regel, die eine als „(optional)“ beschriftete Frage zur Pflicht macht.

## Antworten in Texte einsetzen

Mit Platzhaltern setzen Sie frühere Antworten in Texte ein. Ein Platzhalter besteht aus dem technischen Schlüssel des Feldes in doppelten geschweiften Klammern, etwa `{{name}}` oder `{{fristende}}`. Den Schlüssel finden Sie beim Feld unter **Technischer Schlüssel** (siehe [Kapitel 2](02-formulare-erstellen.md#technischer-schlüssel)).

Platzhalter wirken im Titel und in der Einleitung des Formulars, in Seitentiteln und -beschreibungen, in Fragen und Hilfetexten sowie in Überschrift und Text der Abschlussseiten. Beispiele:

- Frage: „Worum geht es, {{name}}?“
- Abschlussseite: „Danke, {{name}}. Weil eine Frist läuft (Ende: {{fristende}}), prüfen wir Ihre Anfrage vorrangig.“

PLICA zeigt die Antwort lesbar formatiert, ein Datum also etwa als „14.11.2026“. Ist die Antwort leer, entfällt der Platzhalter. Übrig gebliebene Satzzeichen räumt PLICA auf: Aus „Worum geht es, ?“ wird „Worum geht es?“.

Bei Abschlussseiten müssen Sie den Schlüssel nicht kennen: **Antwort einsetzen** über dem Textfeld listet alle Fragen und fügt den passenden Platzhalter ein. Auch E-Mails aus Automationen können Platzhalter enthalten, siehe [Kapitel 8](08-automationen.md).

## Abschlussseiten

Nach dem Absenden sieht die Person eine Abschlussseite. Sie bearbeiten sie im Reiter **Abschluss**.

- Die erste Abschlussseite ist der **Standard**. Sie erscheint immer, wenn keine Regel eine andere auswählt.
- **Weitere Abschlussseite** legt zusätzliche Abschlussseiten an. Welche erscheint, bestimmen Sie mit der Regelaktion **Zeige Abschlussseite**. Abschlussseiten, die eine Regel verwendet, tragen den Zusatz „per Regel“.
- Jede Abschlussseite hat eine **Überschrift** und einen **Text**. Der Text kann Platzhalter enthalten.
- **Weiterleitung (optional)** schickt die Person statt auf die Abschlussseite direkt zu einer anderen Adresse, etwa zur Danke-Seite der Kanzlei-Website. Die Adresse muss mit `http://` oder `https://` beginnen.

Löschen Sie eine Abschlussseite, entfernt PLICA auch die Regelaktionen, die auf sie verweisen.

Schreiben Sie auf die Abschlussseite, was als Nächstes passiert, etwa: „Wir prüfen Ihr Anliegen und melden uns innerhalb von zwei Werktagen per E-Mail oder Telefon.“

## Berechnungen

Das Feld **Berechnung** (Gruppe Fortgeschritten) rechnet mit einer Formel aus anderen Antworten. Das Ergebnis erscheint im Formular, kann aber nicht verändert werden. Beim Absenden rechnet PLICA auf dem Server nach und speichert dieses Ergebnis mit der Antwort.

### Eine Formel eingeben

1. Fügen Sie ein Feld **Berechnung** ein und geben Sie ihm eine Frage, etwa „Summe der offenen Rechnungen“.
2. Im Abschnitt **Formel** tippen Sie die Formel in das Feld **Berechnung**. Felder setzen Sie mit ihrem Schlüssel in einfachen geschweiften Klammern ein, etwa `{betrag}`. Einfacher geht es über **Felder einsetzen**: Ein Klick auf einen Schlüssel fügt ihn ein.
3. Unter der Formel zeigt **Probe (jede Zahl = 10)** ein Beispielergebnis. Dabei gilt jedes Zahlenfeld als 10, jedes Ja als 1. So erkennen Sie, ob die Formel grundsätzlich rechnet.
4. **Nachkommastellen in der Anzeige** legt fest, wie genau das Ergebnis erscheint (0 bis 6, voreingestellt 2).

Fehler in der Formel meldet PLICA direkt darunter, etwa „Unbekannte Funktion“ oder „Unbekannt: {betrag_netto}“.

### Rechenzeichen

| Zeichen | Bedeutung |
|---|---|
| `+ - * /` | Grundrechenarten |
| `%` | Rest einer Division |
| `^` | Potenz |
| `( )` | Klammern |
| `== != < <= > >=` | Vergleiche (für `if`) |
| `&&` `\|\|` `!` | und, oder, nicht |

Text steht in Anführungszeichen, etwa `"volljährig"`.

### Funktionen

| Funktion | Ergebnis |
|---|---|
| `sum(…)` | Summe, auch über alle Einträge einer Wiederholgruppe |
| `avg(…)` | Durchschnitt |
| `min(…)`, `max(…)` | kleinster bzw. größter Wert |
| `count(…)` | Zahl der ausgefüllten Werte |
| `round(x, 2)` | auf zwei Nachkommastellen runden |
| `floor(x)`, `ceil(x)` | ab- bzw. aufrunden auf ganze Zahlen |
| `abs(x)` | Betrag ohne Vorzeichen |
| `if(bedingung, dann, sonst)` | Wert abhängig von einer Bedingung |
| `days_between({von}, {bis})` | Tage zwischen zwei Datumsfeldern |
| `years_since({datum})` | volle Jahre seit einem Datum, etwa das Alter |
| `len(…)` | Länge eines Textes bzw. Zahl der Einträge einer Wiederholgruppe |
| `concat(…)` | Texte aneinanderhängen |

### Beispiele

- **Summe offener Rechnungen.** Eine Wiederholgruppe „Offene Rechnungen“ enthält ein Feld Betrag mit dem Schlüssel `betrag`. Die Formel `sum({betrag})` addiert die Beträge aller Einträge. `len({betrag})` zählt die Rechnungen.
- **Alter aus dem Geburtsdatum.** `years_since({geburtsdatum})` ergibt das Alter in vollen Jahren. Mit `if(years_since({geburtsdatum}) >= 18, "volljährig", "minderjährig")` zeigt das Feld einen Text.
- **Dauer eines Arbeitsverhältnisses.** Zwei Datumsfelder `beginn` und `ende`: `round(days_between({beginn}, {ende}) / 365, 1)` ergibt die Dauer in Jahren mit einer Nachkommastelle.
- **Betrag mit Aufschlag.** `round({betrag} * 1.19, 2)` rechnet 19 Prozent auf und rundet auf Cent.

### Gut zu wissen

- Leere Zahlenfelder zählen beim Rechnen als 0.
- Eine Division durch 0 oder eine Formel, die sich nicht auswerten lässt, ergibt ein leeres Ergebnis. Im Formular erscheint dann „–“.
- Ein Berechnungsfeld kann das Ergebnis eines anderen Berechnungsfeldes verwenden.
- Auf ein Berechnungsfeld können Regeln reagieren, etwa: Wenn „Summe der offenen Rechnungen“ ist größer als 5.000, dann zeige ein Infotext-Feld.
- Setzen Sie das Berechnungsfeld außerhalb der Wiederholgruppe. Innerhalb einer Gruppe rechnet PLICA es nicht aus.
- `days_between` braucht zwei einzelne Datumsfelder. Mit einem Feld vom Typ Zeitraum funktioniert es nicht.
- Formeln sind kein Programmcode. PLICA wertet sie mit einem eigenen, abgesicherten Rechenwerk aus.

← [Formulare erstellen](02-formulare-erstellen.md) · weiter: [Darstellung](04-darstellung.md) →
