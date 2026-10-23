# 8 · Automationen und Freigaben

Automationen erledigen wiederkehrende Arbeit nach dem Eingang einer Antwort: das Team informieren, dem Mandanten den Eingang bestätigen, eine Anwältin um Freigabe bitten, ein PDF ablegen oder die Daten an ein anderes System übergeben. Sie richten sie je Formular im Reiter **Automationen** ein.

Anlegen, ändern, testen und erneut anstoßen dürfen Bearbeiter, Administratoren und Inhaber. Alle anderen sehen Automationen und Protokoll nur.

## Aufbau einer Automation

Jede Automation folgt demselben Muster:

1. **Wann** – ein Auslöser, z. B. „Neue Antwort eingegangen“.
2. **Nur wenn** (optional) – Bedingungen an die Angaben der Antwort.
3. **Dann** – Schritte, die nacheinander ausgeführt werden.
4. **Sonst** (optional) – Schritte für den Fall, dass die Bedingung nicht zutrifft.

Ein Formular kann mehrere Automationen haben. Passen bei einem Ereignis mehrere, laufen sie in der Reihenfolge, in der sie angelegt wurden.

## Automation anlegen

Klicken Sie auf **Neue Automation** und wählen Sie eine Vorlage oder **Leer beginnen**:

| Vorlage | Was sie anlegt |
|---|---|
| Team benachrichtigen | E-Mail mit allen Angaben an feste Adressen |
| Eingangsbestätigung | Bestätigung an die einreichende Person, mit PDF der Angaben |
| Prüfen und freigeben | Freigabe anfordern |
| An anderes System senden | signierter Webhook, z. B. an die Aktenverwaltung |

Im Dialog geben Sie einen **Name** ein, wählen den **Auslöser**, ergänzen bei Bedarf Bedingungen und fügen mit **Schritt hinzufügen** Schritte hinzu. Die Pfeile ändern die Reihenfolge der Schritte. Der Schalter **Aktiv** / **Pausiert** unten links bestimmt, ob die Automation läuft. **Anlegen** bzw. **Speichern** übernimmt die Einstellungen.

In der Liste schalten Sie jede Automation mit dem Schalter links an oder aus. Rechts sehen Sie das Ergebnis des letzten Laufs. Über **⋯** erreichen Sie **Bearbeiten**, **Mit letzter Antwort testen** und **Löschen …**.

## Auslöser

| Auslöser | Startet, wenn … |
|---|---|
| Neue Antwort eingegangen | eine Antwort abgesendet wurde |
| Status einer Antwort geändert | eine Antwort einen bestimmten Status erhält (Auswahl unter **Neuer Status**, z. B. „auf „Erledigt““) |
| Freigabe erteilt | jemand eine Freigabe dieser Antwort erteilt hat |
| Freigabe abgelehnt | jemand eine Freigabe dieser Antwort abgelehnt hat |

„Status einer Antwort geändert“ reagiert auf jede Statusänderung – aus der Oberfläche, über die [API](integrationen.md#status-und-tags-setzen), aus einer Freigabe oder aus einem Schritt „Status ändern“ einer anderen Automation.

## Bedingungen

Unter **Nur wenn** vergleichen Sie Felder der Antwort mit einem Wert. Welche Vergleiche es gibt, hängt vom Feldtyp ab:

| Feldtyp | Vergleiche |
|---|---|
| Text und alle übrigen Typen | ist, ist nicht, enthält, enthält nicht, ist leer, ist ausgefüllt |
| Einfachauswahl, Dropdown | ist, ist nicht, ist leer, ist ausgefüllt |
| Mehrfachauswahl | enthält, enthält nicht, ist leer, ist ausgefüllt |
| Zahl, Betrag, Bewertung, Schieberegler, berechnetes Feld | größer als, mindestens, kleiner als, höchstens, gleich, ungleich, ist leer, ist ausgefüllt |
| Datum, Datum und Uhrzeit | nach, vor, am, ist leer, ist ausgefüllt |
| Ja/Nein | ist (Ja bzw. Nein) |
| Einwilligung | erteilt, nicht erteilt |

Bei mehreren Bedingungen legen Sie fest: Es muss **jede** oder **mindestens eine** Bedingung zutreffen. Gruppen, Datei-Uploads und Unterschriften stehen für Bedingungen nicht zur Verfügung.

Trifft die Bedingung nicht zu und es gibt keine Sonst-Schritte, passiert nichts – es entsteht dann auch kein Eintrag im Protokoll.

Wird ein Feld aus dem Formular entfernt, zeigt die Bedingung „Gelöschtes Feld – bitte wählen“. Wählen Sie dann ein anderes Feld oder entfernen Sie die Bedingung.

## Schritte

| Schritt | Wirkung |
|---|---|
| E-Mail senden | E-Mail an feste Adressen oder an die Adresse aus einem E-Mail-Feld |
| Bestätigung an Einreichende | E-Mail an die Adresse aus der Antwort |
| Webhook auslösen | signierter `POST` mit den Antwortdaten an ein anderes System |
| Status ändern | setzt den Status der Antwort (Neu, In Prüfung, Freigegeben, Abgelehnt, Erledigt) |
| Freigabe anfordern | legt eine Freigabeaufgabe an |
| PDF erzeugen | erzeugt ein PDF nach der Standard-PDF-Vorlage und legt es an der Antwort ab |

### E-Mail senden

- **An:** mehrere Adressen mit Komma trennen. Für die Adresse aus der Antwort tragen Sie den Feldschlüssel des E-Mail-Feldes ein, z. B. `{{email}}`; der Hinweis unter dem Feld nennt die passenden Schlüssel.
- **Betreff** und **Text** mit [Platzhaltern](#platzhalter-in-e-mails).
- **PDF der Antwort anhängen** fügt das PDF nach der Standardvorlage bei ([Kapitel 7](07-export-pdf.md#pdf-vorlage)).

Enthält die Antwort eine E-Mail-Adresse, setzt PLICA sie als Antwortadresse (Reply-To). Ihr Team kann also direkt aus dem Postfach antworten.

### Bestätigung an Einreichende

Geht an die Adresse aus dem (ersten) E-Mail-Feld der Antwort. Hat das Formular kein E-Mail-Feld oder die Person keine Adresse angegeben, wird der Schritt übersprungen und als „Übersprungen“ protokolliert. Mit **PDF der Angaben anhängen** erhält die Person ihre Angaben als PDF. Unter der Mail steht der Name des Workspace.

### Webhook auslösen

Tragen Sie unter **Adresse (URL)** das Ziel ein. PLICA sendet die Antwort als JSON und signiert sie mit dem Webhook-Geheimnis des Workspace (**Einstellungen → API und Webhooks**). Aufbau, Signaturprüfung und Wiederholungsverhalten beschreibt [Integrationen und API](integrationen.md#webhooks).

Ziele in privaten Netzen (z. B. `192.168.…`, `10.…`, `localhost`) sind gesperrt, solange der Betreiber nicht `WEBHOOK_ALLOW_PRIVATE=true` setzt. Ist das Ziel eine solche IP-Adresse, lehnt PLICA schon das Speichern ab; ein Hostname, der auf eine interne Adresse zeigt, scheitert bei der Zustellung.

### Status ändern

Setzt den Status der Antwort. Das kann seinerseits Automationen mit dem Auslöser „Status einer Antwort geändert“ starten. Damit sich Automationen nicht endlos gegenseitig anstoßen, verfolgt PLICA höchstens drei verkettete Statuswechsel durch Automationen.

### Freigabe anfordern

- **Aufgabe:** Titel der Freigabe, Platzhalter sind erlaubt, z. B. `Annahme prüfen: {{name}}`.
- **Wer entscheidet:** Prüfer und höher, Bearbeiter und höher, Administratoren und Inhaber oder Nur Inhaber.

Die Antwort wechselt dabei von Neu auf In Prüfung. Ist der E-Mail-Versand eingerichtet, erhalten alle Mitglieder mit passender Rolle eine Mail „Freigabe erbeten: …“ mit den Angaben und dem Link **Zu den Freigaben**.

Die Automation wartet **nicht** auf die Entscheidung; folgende Schritte laufen sofort weiter. Was nach der Entscheidung geschehen soll, legen Sie in einer eigenen Automation mit dem Auslöser „Freigabe erteilt“ bzw. „Freigabe abgelehnt“ an. Ein vollständiges Beispiel folgt [unten](#beispiel-mandantenaufnahme-mit-freigabe-und-übergabe-an-j-lawyer).

### PDF erzeugen

Erzeugt ein PDF nach der Standardvorlage des Formulars und legt es an der Antwort ab. Sie finden es in der Detailansicht unter **Erzeugte Dokumente** und über die API.

## Platzhalter in E-Mails

In Betreff, Text und Freigabetitel ersetzt PLICA diese Platzhalter. Unter dem Textfeld fügen Schaltflächen sie an der Cursorposition ein.

| Platzhalter | Inhalt |
|---|---|
| `{{plica.nummer}}` | Antwortnummer |
| `{{plica.formular}}` | Formulartitel |
| `{{plica.antworten}}` | alle Angaben, je Zeile „Frage: Antwort“ |
| `{{plica.link}}` | Link zur Antwort in der Verwaltung |
| `{{plica.datum}}` | Eingangszeitpunkt der Antwort |
| `{{plica.status}}` | aktueller Status |
| `{{feldschluessel}}` | Wert eines Feldes, z. B. `{{name}}` |

Links im Text werden in der HTML-Mail klickbar. `{{plica.link}}` zeigt auf die Verwaltung (`APP_URL`); setzen Sie ihn nur in Mails an Ihr Team, nicht an Mandanten.

Alle Mails von PLICA verwenden ein schlichtes Layout mit der Akzentfarbe Petrol (#0b5c66) für Knöpfe und Links und tragen einen Textteil für Mailprogramme ohne HTML.

## Freigaben

Freigaben bringen eine menschliche Entscheidung in einen Ablauf, etwa die Kollisionsprüfung und Annahme eines Mandats. Sie entstehen durch den Schritt **Freigabe anfordern**.

### Entscheiden

Die Seite **Freigaben** in der Seitenleiste sammelt alle Freigaben des Workspace; die Zahl am Menüpunkt zeigt die offenen. Unter **Offen** sehen Sie je Aufgabe Titel, Formular und Antwortnummer, die ersten Angaben, wann und durch welche Automation sie angefordert wurde und für welche Rolle sie bestimmt ist. **Entschieden** zeigt die erledigten mit Ergebnis, Person und Zeitpunkt.

- **Freigeben** – mit optionalem Kommentar.
- **Ablehnen** – eine **Begründung** ist Pflicht.

Entscheiden kann, wer mindestens die Rolle Prüfer hat und mindestens die Rolle, für die die Freigabe bestimmt ist. Über jede Freigabe wird genau einmal entschieden, auch wenn zwei Personen gleichzeitig klicken.

### Was die Entscheidung bewirkt

1. Die Antwort erhält den Status **Freigegeben** bzw. **Abgelehnt**.
2. Der Verlauf der Antwort vermerkt die Entscheidung mit Kommentar.
3. Automationen mit dem Auslöser „Freigabe erteilt“ bzw. „Freigabe abgelehnt“ starten.
4. Weil sich der Status ändert, starten außerdem Automationen mit „Status einer Antwort geändert“ auf Freigegeben bzw. Abgelehnt.

Richten Sie dieselbe Folgeaktion deshalb nur über **einen** der beiden Wege ein, sonst läuft sie doppelt.

## Beispiel: Mandantenaufnahme mit Freigabe und Übergabe an j-lawyer

Das Formular „Mandantenaufnahme“ fragt u. a. `name`, `email`, `gegner`, `rechtsgebiet` und eine Unterschrift ab. Ziel: Der Mandant erhält sofort eine Bestätigung, eine Anwältin entscheidet über die Annahme, und erst nach der Freigabe gehen die Daten an j-lawyer.

**Automation 1 „Eingang“** – Auslöser: Neue Antwort eingegangen

1. **Bestätigung an Einreichende** mit dem Text „Vielen Dank, wir haben Ihre Angaben erhalten und melden uns innerhalb von zwei Werktagen.“ und **PDF der Angaben anhängen**.
2. **Freigabe anfordern**, Aufgabe `Kollisionsprüfung und Annahme: {{name}} gegen {{gegner}}`, Wer entscheidet: Bearbeiter und höher.

Die Antwort steht jetzt auf In Prüfung, die Anwältinnen erhalten die Mail „Freigabe erbeten“.

**Automation 2 „Übergabe an j-lawyer“** – Auslöser: Freigabe erteilt

1. **PDF erzeugen** – der Aufnahmebogen liegt an der Antwort.
2. **Webhook auslösen** an `http://192.168.10.5:8090/plica` – ein kleiner Empfangsdienst im Kanzleinetz, der die Signatur prüft und über die REST-API von j-lawyer Kontakt und Akte anlegt.

Der Empfangsdienst kann anschließend über die PLICA-API den Status auf Erledigt und den Tag `akte-angelegt` setzen. Den Code dafür zeigt [Integrationen und API](integrationen.md#beispiel-mandantenaufnahme-an-j-lawyer-im-lan).

**Automation 3 „Absage vorbereiten“** – Auslöser: Freigabe abgelehnt

1. **E-Mail senden** an `sekretariat@kanzlei.de`, Betreff `Mandat abgelehnt: {{name}}`, Text mit `{{plica.link}}`. Die Absage an den Mandanten formuliert das Sekretariat selbst.

Damit Schritt 2 der zweiten Automation das Ziel im LAN erreicht, muss der Betreiber `WEBHOOK_ALLOW_PRIVATE=true` setzen ([Kapitel 21](21-konfiguration.md)). Der Port des Ziels muss 80, 443 oder 1024 und höher sein.

## Testlauf

**⋯ → Mit letzter Antwort testen** führt die Automation sofort mit der neuesten Antwort des Formulars aus, auch wenn sie pausiert ist. Das Formular braucht dafür mindestens eine Antwort.

Ein Testlauf ist ein **echter** Lauf:

- E-Mails gehen wirklich hinaus, mit „[Test]“ vor dem Betreff – bei „Bestätigung an Einreichende“ auch an die Person, die das Formular ausgefüllt hat.
- Webhooks tragen `"test": true` im Body und die Kopfzeile `X-Plica-Test: 1`. Empfänger sollten bei Tests keine echten Datensätze anlegen.
- „Status ändern“ ändert den Status der Antwort tatsächlich, und „Freigabe anfordern“ legt eine echte Freigabeaufgabe an.

Testen Sie deshalb am besten mit einer eigenen Testantwort. Im Protokoll ist der Lauf als „Testlauf“ gekennzeichnet.

## Protokoll

Unter **Protokoll** stehen die letzten 50 Läufe aller Automationen des Formulars. Jeder Lauf zeigt Automation, Antwortnummer, Zeitpunkt und Ergebnis:

| Anzeige | Bedeutung |
|---|---|
| Läuft | in Arbeit oder wartet auf einen neuen Versuch |
| Erfolgreich | alle Schritte erledigt |
| Teilweise | mindestens ein Schritt erfolgreich, mindestens einer fehlgeschlagen |
| Fehlgeschlagen | kein Schritt erfolgreich |

Ein Klick klappt die Schritte auf: Haken oder Kreuz, Meldung (z. B. „Webhook zugestellt (HTTP 200).“ oder „Webhook-Ziel lehnte ab (HTTP 400).“), Versuchsnummer und Uhrzeit. Läufe über den Sonst-Zweig sind mit „Sonst-Zweig“ gekennzeichnet. **Aktualisieren** lädt den aktuellen Stand.

Jeder Lauf erscheint zusätzlich im Verlauf der Antwort ([Kapitel 6](06-antworten.md#verlauf)).

## Zuverlässigkeit: Worker und Warteschlange

Automationen und Benachrichtigungen führt ein eigener Prozess aus, der **Worker**. Damit beim Absenden niemand warten muss und nichts verloren geht, gilt:

- **Nichts geht verloren.** Beim Absenden schreibt PLICA die Antwort und den Auftrag für den Worker in derselben Datenbank-Transaktion. Gibt es die Antwort, gibt es auch den Auftrag.
- **Ohne Worker passiert nichts.** Läuft der Worker nicht, bleiben Läufe auf „Läuft“ bzw. „Wartet auf den Worker …“ stehen und werden abgearbeitet, sobald er wieder läuft. Den Betrieb beschreibt [Kapitel 25](25-betrieb-cli.md).
- **Schritte laufen nacheinander.** Ein Schritt beginnt erst, wenn der vorherige erledigt ist.
- **Erledigtes wird nicht wiederholt.** Jeder erfolgreich ausgeführte Schritt wird sofort festgehalten. Bei einem neuen Versuch oder nach einem Absturz des Workers setzt PLICA beim ersten offenen Schritt fort. Bricht ein Worker ab, übernimmt nach etwa zwei Minuten ein anderer bzw. der neu gestartete Worker den Auftrag.

### Wie PLICA mit Fehlern umgeht

| Fehlerart | Beispiele | Verhalten |
|---|---|---|
| vorübergehend | Mailserver nicht erreichbar, Webhook-Ziel antwortet nicht innerhalb von 10 Sekunden, HTTP 429 oder 5xx, Server nicht gefunden | Der Schritt wird automatisch wiederholt; die folgenden Schritte warten. Im Protokoll steht „Neuer Versuch folgt automatisch.“ |
| endgültig | Webhook-Ziel antwortet mit einem anderen 4xx-Code, Ziel im gesperrten internen Netz, keine gültige Empfängeradresse, E-Mail-Versand nicht eingerichtet | Der Schritt gilt sofort als fehlgeschlagen, die folgenden Schritte laufen trotzdem weiter. |

Wiederholt wird mit wachsendem Abstand: nach 30 Sekunden, 1, 2, 4, 8 Minuten und so weiter bis höchstens 6 Stunden, jeweils mit etwas zufälliger Streuung. Nach 12 Versuchen – das sind rund 15 Stunden, genug für einen nächtlichen Ausfall des Mailservers – gilt der Schritt als fehlgeschlagen, und die restlichen Schritte des Laufs werden ausgeführt. Testläufe versucht PLICA höchstens dreimal.

## Fehlgeschlagene Zustellungen erneut versuchen

Was endgültig gescheitert ist, zeigt PLICA an zwei Stellen in einem roten Hinweis „… ist fehlgeschlagen“:

- im Reiter **Automationen** des betroffenen Formulars,
- auf der Startseite **Formulare** für alle Formulare des Workspace (für Bearbeiter, Administratoren und Inhaber).

Angezeigt werden Probleme der letzten 30 Tage, z. B. „Automation „Übergabe an j-lawyer“ fehlgeschlagen · Antwort #17“ oder „Benachrichtigung über neue Antwort · Antwort #18“ mit der letzten Fehlermeldung. Ein fehlgeschlagener Lauf verschwindet aus der Liste, sobald ein späterer Lauf derselben Automation für dieselbe Antwort erfolgreich war.

Beheben Sie zuerst die Ursache – Mailserver, Zugangsdaten, Webhook-Ziel – und klicken Sie dann auf **Erneut versuchen**. Dabei gibt es einen Unterschied:

- **Benachrichtigungen und abgebrochene Aufträge** setzt PLICA dort fort, wo sie stehen geblieben sind. Bereits erledigte Schritte laufen nicht noch einmal, und ein Webhook behält seine Zustell-ID.
- **Fehlgeschlagene oder teilweise fehlgeschlagene Automationsläufe** startet PLICA als neuen Lauf. Dabei werden **alle** Schritte dieser Automation für die Antwort erneut ausgeführt – auch solche, die beim ersten Mal geklappt hatten. Eine bereits versandte Bestätigung geht also ein zweites Mal hinaus, und eine Freigabe wird erneut angefordert. Prüfen Sie im Protokoll, welche Schritte betroffen sind, bevor Sie neu starten.

Denselben Neustart eines Laufs bietet im Protokoll der Knopf **Erneut ausführen** bei fehlgeschlagenen und teilweise fehlgeschlagenen Läufen.

← [Export und PDF](07-export-pdf.md) · weiter: [Team und Rollen](10-team-rollen.md) →
