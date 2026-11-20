# 5 · Veröffentlichen und Teilen

Ein Formular ist erst öffentlich, wenn Sie es veröffentlichen. Alles Weitere – Link, QR-Code, Einbettung, Passwort, Frist und Höchstzahl – regeln Sie im Reiter **Teilen** des Formulars.

Einstellungen im Reiter **Teilen** ändern können Bearbeiter, Administratoren und Inhaber. Leser und Prüfer sehen Link, QR-Code und Einbettungscode. Die Status-Knöpfe sind für sie ausgeblendet, die Abschnitte **Zugang** und **Benachrichtigung** gesperrt. Die Rollen erklärt [Kapitel 10](10-team-rollen.md).

## Veröffentlichen und Versionen

Im Editor klicken Sie oben rechts auf **Veröffentlichen** (beim ersten Mal) bzw. **Änderungen veröffentlichen**. Denselben Knopf gibt es im Reiter **Teilen** unter **Status**.

Vor dem Veröffentlichen prüft PLICA das Formular:

- **Fehler** (z. B. eine Regel, die auf ein gelöschtes Feld zeigt) verhindern die Veröffentlichung. Der Dialog „Vor dem Veröffentlichen beheben“ listet sie auf; ein Klick auf einen Eintrag öffnet die Stelle im Editor.
- **Hinweise** blockieren nicht. Sie können sie prüfen oder mit **Trotzdem veröffentlichen** fortfahren.

Jede Veröffentlichung erzeugt eine neue, unveränderliche **Version** (Version 1, 2, 3 …). Danach erscheint der Dialog „Dein Formular ist online“ mit Link, QR-Code und dem Verweis **Teilen-Optionen öffnen**.

Wichtig für den Alltag:

- **Änderungen im Editor bleiben Entwurf**, bis Sie erneut veröffentlichen. Ausfüllende sehen so lange die bisherige Version. Der Reiter **Teilen** weist mit einem Hinweis darauf hin, wenn der Entwurf unveröffentlichte Änderungen enthält.
- **Jede Antwort behält ihre Version.** Sie wird später immer mit den Feldern der Version angezeigt und exportiert, mit der sie abgesendet wurde.
- **Neu veröffentlicht während jemand ausfüllt:** Beim Absenden erhält die Person den Hinweis, dass das Formular gerade aktualisiert wurde, und soll die Seite neu laden und erneut senden. PLICA prüft eine Antwort nie stillschweigend gegen eine andere Version, als die Person gesehen hat.
- **Die Adresse beim ersten Veröffentlichen:** Hat das Formular noch eine Platzhalter-Adresse und Sie haben sie nicht selbst angepasst, bildet PLICA sie beim ersten Veröffentlichen aus dem Titel (z. B. `/f/mandantenaufnahme`). Danach ändert sich die Adresse nie mehr automatisch.

## Status: pausieren, archivieren, wieder öffnen

Der Abschnitt **Status** zeigt, ob das Formular gerade Antworten annimmt, und die aktuelle Version mit Veröffentlichungszeit.

| Anzeige | Bedeutung | Was Besucher sehen |
|---|---|---|
| Nimmt Antworten an | veröffentlicht und offen | das Formular |
| Pausiert | vorübergehend geschlossen | „Dieses Formular nimmt vorübergehend keine Antworten an.“ |
| Archiviert | dauerhaft geschlossen | „Dieses Formular ist nicht mehr verfügbar.“ |
| Noch nie veröffentlicht / Nicht öffentlich | kein öffentlicher Zugriff | Seite nicht gefunden |

Die Knöpfe dazu: **Pausieren** und **Wieder öffnen**, **Archivieren** und **Wieder veröffentlichen**. Bereits eingegangene Antworten bleiben in jedem Status erhalten.

Zwei Wege führen aus dem Archiv, mit unterschiedlicher Wirkung: **Wieder veröffentlichen** hier im Reiter **Teilen** macht die letzte Version sofort wieder öffentlich. **Aus dem Archiv holen** in der Formularliste macht das Formular dagegen zum Entwurf; der Link bleibt geschlossen, bis Sie erneut veröffentlichen. **Archivieren** erscheint im Reiter **Teilen** nur, wenn das Formular schon einmal veröffentlicht war; in der Formularliste lassen sich auch Entwürfe archivieren.

Neben dem Status schließen auch [Zeitraum und Höchstzahl](#zugang-passwort-zeitraum-und-limit) ein Formular, ohne dass Sie den Status ändern.

## Öffentliche Adresse und eigene Domain

Der Abschnitt **Link** zeigt die öffentliche Adresse, z. B. `https://formulare.example.de/f/mandantenaufnahme`, mit **Link kopieren** und **Öffnen**. Der Link funktioniert, sobald das Formular veröffentlicht ist und Antworten annimmt.

### Zwei Adressen: Formulare öffentlich, Verwaltung intern

PLICA kennt zwei Adressen, die der Betreiber festlegt ([Kapitel 21](21-konfiguration.md)):

- `APP_URL` – die Verwaltung, in der Sie arbeiten,
- `PUBLIC_URL` – optional eine eigene Domain nur für öffentliche Formulare.

Ist `PUBLIC_URL` gesetzt, bauen Link, QR-Code, Einbettungscode, Fortsetzungs- und Folgeformular-Links immer auf dieser Domain auf. Auf der öffentlichen Domain antworten nur die Pfade, die Ausfüllende brauchen: `/f/…` (Formulare), `/r/…` (Fortsetzungslinks), `/api/public/…` (Absenden, Hochladen, Zwischenstand), `/embed.js` sowie technische Pfade für Skripte, Favicon und Statusprüfung. Alles andere – Anmeldung, Verwaltung, REST-API – liefert dort „Nicht gefunden“.

So kann die Verwaltung ausschließlich im Kanzleinetz oder per VPN erreichbar sein, während Mandanten die Formulare aus dem Internet öffnen. Die Einrichtung am Reverse Proxy beschreibt [Kapitel 22](22-reverse-proxy.md).

Beachten Sie: Links, die PLICA an Ihr Team schickt (z. B. „In PLICA öffnen“ in Benachrichtigungen), zeigen auf die Verwaltung. Sie funktionieren nur dort, wo die Verwaltung erreichbar ist.

### Adresse anpassen

Unter **Adresse anpassen** ändern Sie den Teil nach `/f/`:

- 3 bis 60 Zeichen, nur Kleinbuchstaben, Ziffern und Bindestriche (Umlaute und Leerzeichen werden beim Tippen zu Bindestrichen),
- jede Adresse gibt es nur einmal; PLICA meldet „Diese Adresse ist frei.“ oder „Diese Adresse ist bereits vergeben.“,
- einige Adressen sind reserviert.

Nach **Speichern** fragt PLICA nach: Der bisherige Link und bereits gedruckte QR-Codes funktionieren danach nicht mehr. Ändern Sie die Adresse also, bevor Sie Flyer drucken.

## QR-Code

Der Abschnitt **QR-Code** zeigt einen Code zur öffentlichen Adresse, schwarz auf weiß mit Ruhezone und mittlerer Fehlerkorrektur, damit er auch gedruckt zuverlässig lesbar bleibt.

- **SVG für den Druck** – verlustfrei skalierbar, für Flyer und Aushänge,
- **PNG (1200 px)** – für Präsentationen, E-Mails oder Bildschirme.

Ändern Sie die Adresse, ändert sich auch der QR-Code.

## In Website einbetten

Unter **In Website einbetten** erhalten Sie fertigen HTML-Code. Das Formular erscheint dann ohne PLICA-Rahmen direkt in Ihrer Seite.

- **Mit automatischer Höhe** (empfohlen): ein `<div>` und das Skript `embed.js`. Das Skript passt die Höhe bei jedem Schritt an, es entstehen keine doppelten Scrollbalken. Es nimmt nur Formulare und Nachrichten Ihres eigenen PLICA-Servers an.
- **Nur iframe**: ein schlichtes `<iframe>` mit fester Höhe (900 px). Wählen Sie die Höhe großzügig, vor allem bei mehrstufigen Formularen.

```html
<div data-plica-form="https://formulare.example.de/f/kontakt" data-plica-title="Kontakt"></div>
<script src="https://formulare.example.de/embed.js" async></script>
```

Auf welchen Websites die Einbettung erlaubt ist, legt der Betreiber mit `EMBED_ORIGINS` fest; der Reiter zeigt die aktuelle Einstellung an. Ohne Angabe ist die Einbettung überall erlaubt. Für die Kanzlei-Website empfiehlt sich, nur die eigene Domain einzutragen ([Kapitel 21](21-konfiguration.md)).

Antworten aus eingebetteten Formularen sind in der Detailansicht mit „über eingebettetes Formular“ gekennzeichnet.

## Zugang: Passwort, Zeitraum und Limit

Der Abschnitt **Zugang** legt fest, wer das Formular wann und wie oft ausfüllen kann.

### Passwortschutz

Geben Sie ein Passwort mit mindestens 4 Zeichen ein und klicken Sie auf **Aktivieren**. Später können Sie es **Ändern** oder **Entfernen**.

Besucher sehen dann zuerst die Abfrage „Dieses Formular ist geschützt“ und müssen das Passwort eingeben. Nach erfolgreicher Eingabe bleibt das Formular in diesem Browser 12 Stunden geöffnet. Nach mehreren Fehlversuchen muss man eine Weile warten.

Teilen Sie das Passwort getrennt vom Link, z. B. den Link per E-Mail und das Passwort telefonisch.

### Zeitraum

- **Geöffnet ab** – leer bedeutet sofort. Vorher sehen Besucher „Dieses Formular ist ab … Uhr geöffnet.“
- **Antworten bis** – danach erscheint „Die Frist für dieses Formular ist abgelaufen.“ statt des Formulars.

Datum und Uhrzeit geben Sie in der Zeit Ihres Rechners ein; PLICA zeigt den Beginn für Besucher in deutscher Zeit (Europe/Berlin) an.

### Höchstzahl an Antworten

**Höchstens Antworten** begrenzt die Zahl der Einreichungen; leer bedeutet unbegrenzt. Das Feld zeigt, wie viele Antworten bisher eingegangen sind. PLICA zählt beim Absenden atomar mit: Auch wenn zwei Personen gleichzeitig den letzten Platz absenden, wird das Limit nicht überschritten. Danach sehen Besucher „Dieses Formular hat die maximale Anzahl an Antworten erreicht.“

Zeitraum und Höchstzahl speichern Sie gemeinsam mit **Zeitraum und Limit speichern**.

> **Beispiel Seminaranmeldung:** Für ein Arbeitsrechts-Seminar mit 40 Plätzen setzen Sie **Antworten bis** auf den Freitag vor dem Termin, 12:00 Uhr, und **Höchstens Antworten** auf 40. Ist das Seminar ausgebucht oder die Frist vorbei, schließt das Formular von selbst.

## Benachrichtigung und Aufbewahrung

### E-Mail bei neuer Antwort

Tragen Sie unter **E-Mail bei neuer Antwort an** eine oder mehrere Adressen ein (höchstens 20) und klicken Sie auf **Hinzufügen**. Die Änderung wird sofort gespeichert.

Bei jeder neuen Antwort erhalten diese Adressen eine E-Mail mit dem Betreff „Neue Antwort #Nummer: Formulartitel“, einer Zusammenfassung aller Angaben und dem Knopf **In PLICA öffnen**. Enthält die Antwort eine E-Mail-Adresse, ist sie als Antwortadresse (Reply-To) gesetzt – ein Klick auf „Antworten“ im Mailprogramm schreibt also direkt der einreichenden Person.

Voraussetzung ist ein eingerichteter E-Mail-Versand (`SMTP_URL`). Scheitert der Versand dauerhaft, erscheint er als „Benachrichtigung über neue Antwort“ unter den [fehlgeschlagenen Zustellungen](08-automationen.md#fehlgeschlagene-zustellungen-erneut-versuchen).

Für alles, was über eine einfache Benachrichtigung hinausgeht – Bedingungen, eigene Texte, PDF-Anhang, Bestätigung an den Mandanten –, nutzen Sie [Automationen](08-automationen.md).

### Aufbewahrung

**Antworten automatisch löschen nach** legt fest, nach wie vielen Tagen PLICA Antworten dieses Formulars samt Dateien löscht. Leer bedeutet: Es gilt der Standard des Workspace. Die Einstellung gilt für neue Antworten; bereits eingegangene behalten ihr Löschdatum. Die Detailansicht einer Antwort zeigt es als „wird am … gelöscht“.

Hintergründe zu Fristen und Löschung: [Kapitel 12](12-datenschutz-aufbewahrung.md).

## Nach dem Absenden

Was Ausfüllende nach dem Absenden sehen, legen Sie im Editor im Reiter **Abschluss** fest: eine Standard-Abschlussseite, auf Wunsch weitere Abschlussseiten, die Sie über Regeln auswählen ([Kapitel 3](03-logik.md)), oder eine **Weiterleitung** auf eine eigene Adresse wie `https://www.example.de/danke`.

Welche Abschlussseite eine Person gesehen hat, steht bei mehreren Abschlussseiten in der Detailansicht der Antwort („Abschluss: …“).

## Werte über den Link übergeben

Mit einem **versteckten Feld** übernehmen Sie Werte aus dem Link, ohne dass Ausfüllende sie sehen. Tragen Sie im Editor beim versteckten Feld einen **URL-Parameter** ein, z. B. `quelle`. Dann füllt

```
https://formulare.example.de/f/kontakt?quelle=newsletter
```

das Feld mit „newsletter“. So sehen Sie später in der Antwort, ob jemand über den Newsletter, die Website oder einen Flyer kam. Übernommen werden höchstens 500 Zeichen, und nur in versteckte Felder mit eingetragenem Parameter.

## Fortsetzen und Folgeformulare

### Später fortsetzen

Lange Formulare – etwa eine ausführliche Mandantenaufnahme – füllt nicht jeder in einem Zug aus. Aktivieren Sie dafür im Editor im Reiter **Design** die Option **Später fortsetzen erlauben**.

Ausfüllende sehen dann den Knopf **Später fortsetzen**. Ein Klick speichert den Zwischenstand und zeigt einen privaten Link der Form `https://formulare.example.de/r/…`:

- Der Zwischenstand liegt verschlüsselt in der Datenbank; gespeichert wird nur eine Prüfsumme des Links.
- Der Link ist 30 Tage gültig und nur bis zum Absenden. Wer erneut auf **Später fortsetzen** klickt, aktualisiert denselben Link, und die 30 Tage beginnen neu.
- Unter **Link an mich senden** kann sich die Person den Link per E-Mail schicken (höchstens drei Mails pro Stunde und Absender, nur mit eingerichtetem E-Mail-Versand).
- Wer den Link kennt, sieht die bisherigen Angaben. PLICA weist die Ausfüllenden darauf hin.

Beim Öffnen des Links erscheint „Willkommen zurück – Ihre bisherigen Angaben sind wiederhergestellt.“ Wurde das Formular inzwischen neu veröffentlicht, übernimmt PLICA die Angaben in die aktuelle Version, soweit die Felder dort noch existieren. Ist das Formular geschlossen oder der Link abgelaufen, lässt er sich nicht mehr öffnen.

### Folgeformular senden

Oft brauchen Sie von einer Person später weitere Angaben, etwa nach der Mandantenaufnahme die Unterlagen zum Kündigungsschutzverfahren. Statt alles neu abzufragen, schicken Sie ein **Folgeformular**, das mit den bekannten Angaben vorausgefüllt ist.

1. Öffnen Sie die Antwort und klicken Sie auf **Folgeformular senden**.
2. Wählen Sie das **Zielformular**. Angeboten werden alle anderen veröffentlichten Formulare des Workspace.
3. Klicken Sie auf **Link erzeugen** und kopieren Sie den Link in Ihre E-Mail an den Mandanten.

So funktioniert die Vorbefüllung:

- Übernommen werden Felder mit **gleichem Feldschlüssel** und passendem Typ (z. B. `name`, `email`, `anschrift`). Texte, E-Mail, Telefon und versteckte Felder gelten untereinander als passend. Der Dialog nennt die Zahl der vorbefüllten Felder.
- **Nie übernommen** werden Einwilligungen, Unterschriften, Datei-Uploads und berechnete Felder. Einwilligung und Unterschrift muss die Person neu erklären.
- Der Link enthält **keine Antwortdaten**, sondern nur ein signiertes Kennzeichen. Die Werte lädt PLICA beim Öffnen aus der ursprünglichen Antwort, und nur innerhalb desselben Workspace.
- Der Link ist **30 Tage** gültig. Ist das Zielformular passwortgeschützt, bleibt die Vorbefüllung nach der Passworteingabe erhalten.
- Jeder erzeugte Link wird im Protokoll des Workspace vermerkt.

Behandeln Sie den Link wie eine persönliche Nachricht: Wer ihn öffnet, sieht die vorausgefüllten Angaben.

Damit die Zuordnung klappt, vergeben Sie in zusammengehörenden Formularen dieselben Feldschlüssel. Den Schlüssel eines Feldes sehen und ändern Sie im Editor ([Kapitel 2](02-formulare-erstellen.md)).

## Spam-Schutz

Jedes öffentliche Formular ist ohne Captcha gegen automatisierte Einsendungen geschützt:

- **Honeypot:** ein unsichtbares Feld, das nur Bots ausfüllen. Solche Einreichungen verwirft PLICA still.
- **Mindest-Ausfüllzeit:** Wer schneller als 2,5 Sekunden nach dem Laden absendet, erhält einen Hinweis; das Formular sendet nach kurzer Wartezeit automatisch erneut. So gehen Angaben echter Menschen, etwa nach automatischem Ausfüllen durch den Browser, nicht verloren.
- **Begrenzung je Absender:** höchstens 10 Einreichungen pro Minute und Formular von derselben Adresse.
- **Doppelklick-Schutz:** Wird dieselbe Einreichung zweimal gesendet, entsteht nur eine Antwort.

Was dennoch durchrutscht, setzen Sie in der Antwortliste auf den Status **Spam** ([Kapitel 6](06-antworten.md#status)).

← [Darstellung](04-darstellung.md) · weiter: [Antworten](06-antworten.md) →
