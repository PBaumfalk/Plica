# 1 · Überblick

PLICA ist eine Formularplattform für den eigenen Server. Sie bauen damit Online-Formulare, zum Beispiel eine Kundenanfrage, eine Terminanfrage, eine Anmeldung oder eine Einwilligung mit Unterschrift. Wer das Formular ausfüllt, öffnet es über einen Link und braucht kein Konto. Die Antworten landen direkt in PLICA, wo Sie sie prüfen, als PDF ablegen und weiterverarbeiten.

PLICA läuft auf dem eigenen Server der Kanzlei. Formulare, Antworten und hochgeladene Dateien verlassen diesen Server nicht, solange Sie keine Weitergabe einrichten.

Dieses Kapitel erklärt, wie PLICA aufgebaut ist und welchen Weg ein Formular vom ersten Entwurf bis zur Antwort nimmt.

## Anmelden

Sie öffnen PLICA im Browser unter der Adresse, die Ihre IT eingerichtet hat. Je nach Einrichtung melden Sie sich auf eine von zwei Arten an:

- **Mit E-Mail-Adresse und Passwort.** Wenn Ihr Konto einen zweiten Faktor hat, fragt PLICA danach zusätzlich den Code aus Ihrer Authenticator-App ab.
- **Über die zentrale Anmeldung (SSO).** Ist sie eingerichtet, zeigt die Anmeldeseite einen Button **Mit … anmelden**, zum Beispiel „Mit authentik anmelden“ oder „Mit Single Sign-on anmelden“. Sie melden sich dann mit Ihren gewohnten Zugangsdaten an. Passwort und zweiten Faktor verwaltet in diesem Fall der Anmeldedienst, nicht PLICA.

Wie die IT die zentrale Anmeldung einrichtet, steht in Kapitel 21 unter [Anmeldung über authentik](21-konfiguration.md#anmeldung-über-authentik-oidc).

## Die Oberfläche

Nach der Anmeldung sehen Sie links die Seitenleiste. Auf dem Smartphone liegt sie als Leiste am oberen Rand.

- **Oben** steht der Name Ihres Workspace mit Ihrer Rolle. Ein Klick darauf öffnet das Workspace-Menü. Dort wechseln Sie zwischen Workspaces, denen Sie angehören.
- **Suchen und Befehle** öffnet die Befehlspalette (siehe unten).
- **Formulare** ist die Startseite mit allen Formularen des Workspace.
- **Freigaben** sammelt Antworten, die auf Ihre Entscheidung warten. Eine Zahl am Eintrag zeigt, wie viele offen sind. Mehr dazu in [Kapitel 8](08-automationen.md).
- **Vorlagen** enthält fertige Formulare zum Anpassen.
- **Einstellungen** führt zu **Konto** und **Team**, für Administratoren und Inhaber außerdem zu **Workspace**, **Protokoll** und **API und Webhooks**.
- **Unten** wählen Sie über drei Symbole die Darstellung (Hell, Wie System, Dunkel; auf dem Smartphone ausgeblendet, dort gilt die Systemeinstellung) und erreichen über Ihren Namen **Konto und Sicherheit**, **Team** und **Abmelden**.

Das Farbschema heißt „Petrol“: Buttons und Akzente sind in einem dunklen Petrolton gehalten. Den Bereich, in dem Sie sich gerade befinden, hebt die Seitenleiste wie mit einem gelben Textmarker hervor.

Die Verwaltung spricht Sie mit „du“ an. Öffentliche Formulare sprechen Ihre Mandantinnen und Mandanten mit „Sie“ an.

## Workspaces und Rollen

PLICA ordnet alles in **Workspaces**. Ein Workspace ist zum Beispiel die ganze Kanzlei oder ein Dezernat. Er enthält Formulare, Antworten, Automationen, Bausteine und ein Team.

Was Sie in einem Workspace tun dürfen, hängt von Ihrer Rolle ab:

| Rolle | Darf |
|---|---|
| Leser | Formulare und Antworten ansehen |
| Prüfer | zusätzlich Antworten bearbeiten, kommentieren und Freigaben entscheiden |
| Bearbeiter | zusätzlich Formulare bauen, veröffentlichen, automatisieren und exportieren |
| Administrator | zusätzlich Formulare und Antworten löschen, das Team und den Workspace verwalten, API-Schlüssel anlegen und das Protokoll einsehen |
| Inhaber | alles, einschließlich Workspace löschen und Inhaberschaft übertragen |

Fehlt Ihnen ein Button, den dieses Handbuch beschreibt, liegt das meist an der Rolle. Einzelheiten stehen in [Kapitel 10](10-team-rollen.md) und [Kapitel 11](11-workspaces.md).

## Der Weg eines Formulars

Jedes Formular hat einen Status. Sie sehen ihn in der Formularliste als farbige Markierung.

1. **Entwurf.** Sie bauen das Formular im Editor. PLICA speichert jede Änderung automatisch. Der Entwurf ist von außen nicht erreichbar.
2. **Veröffentlicht.** Mit **Veröffentlichen** wird der aktuelle Entwurf zu einer festen Version. Das Formular ist ab dann unter seinem Link erreichbar, zum Beispiel `https://formulare.example.de/f/mandantenaufnahme`. Was Sie danach im Editor ändern, bleibt Entwurf, bis Sie erneut veröffentlichen. Jede Antwort bleibt der Version zugeordnet, mit der sie ausgefüllt wurde.
3. **Pausiert.** Der Link zeigt den Hinweis „Dieses Formular nimmt vorübergehend keine Antworten an.“ Mit **Wieder öffnen** nehmen Sie wieder Antworten an.
4. **Archiviert.** Das Formular verschwindet aus der normalen Liste und ist nur noch unter dem Filter **Archiv** zu finden. Der Link meldet „Dieses Formular ist nicht mehr verfügbar.“ Die Antworten bleiben erhalten. **Aus dem Archiv holen** macht das Formular wieder zum Entwurf. Damit der Link wieder funktioniert, veröffentlichen Sie es danach erneut.

Daneben gibt es den **Papierkorb**. Ein Formular im Papierkorb ist sofort nicht mehr erreichbar. Nach 30 Tagen löscht PLICA es endgültig, zusammen mit allen Antworten und Dateien. Bis dahin lässt es sich wiederherstellen. Den Papierkorb sehen nur Administratoren und Inhaber. **Wiederherstellen** holt das Formular mit seinem früheren Status und unter seiner alten Adresse zurück. **Endgültig löschen** verlangt zur Sicherheit, dass Sie den Formulartitel eintippen; danach sind Formular, Antworten und Dateien unwiderruflich weg.

Ein veröffentlichtes Formular kann außerdem geschlossen sein, ohne pausiert zu sein: wenn es erst ab einem bestimmten Zeitpunkt öffnet, eine Frist abgelaufen ist oder die Höchstzahl an Antworten erreicht ist. Diese Einstellungen nehmen Sie unter **Teilen** vor, siehe [Kapitel 5](05-veroeffentlichen-teilen.md).

## Die Formularliste

Die Startseite **Formulare** zeigt alle Formulare mit Status, Zahl der Antworten und dem Zeitpunkt der letzten Änderung. Über dem Verzeichnis finden Sie:

- das Suchfeld **Formular suchen**,
- den Filter **Aktiv**, **Archiv** und (für Administratoren) **Papierkorb**,
- den Button **Vorlagen** und das Menü **Neues Formular** mit **Leeres Formular**, **Aus Vorlage** und **Aus Beschreibung …**.

Ein Rechtsklick auf ein Formular oder ein Klick auf die drei Punkte am Zeilenende zeigt alle Aktionen: **Bearbeiten**, **Antworten**, **Öffentlich ansehen**, **Duplizieren**, **Pausieren** bzw. **Wieder öffnen**, **Archivieren** bzw. **Aus dem Archiv holen** und **In den Papierkorb …**. Welche Einträge erscheinen, hängt vom Status und Ihrer Rolle ab.

## Die Bereiche eines Formulars

Öffnen Sie ein Formular, sehen Sie oben seine Bereiche als Reiter:

| Reiter | Wofür | Kapitel |
|---|---|---|
| **Bearbeiten** | Felder, Regeln, Abschlussseiten und Design im Editor | [2](02-formulare-erstellen.md), [3](03-logik.md), [4](04-darstellung.md) |
| **Teilen** | Link, QR-Code, Einbettung, Passwort, Frist | [5](05-veroeffentlichen-teilen.md) |
| **Antworten** | eingegangene Antworten prüfen und bearbeiten | [6](06-antworten.md) |
| **Automationen** | Bestätigungen, Benachrichtigungen, Freigaben | [8](08-automationen.md) |
| **Auswertung** | Aufrufe, begonnene und abgesendete Formulare, typische Ausfülldauer | [6](06-antworten.md#auswertung) |
| **PDF-Vorlage** | Aussehen der PDF-Fassung einer Antwort | [7](07-export-pdf.md) |

Leser und Prüfer sehen den Reiter **Bearbeiten** ebenfalls; ein Klick darauf führt sie zu den **Antworten**, weil sie den Editor nicht öffnen dürfen. **Öffentliche Ansicht** rechts oben öffnet das veröffentlichte Formular so, wie Mandantinnen und Mandanten es sehen.

## Ein typischer Ablauf

Am Beispiel einer Mandantenaufnahme:

1. Unter **Vorlagen** wählen Sie „Mandantenaufnahme“ und klicken **Vorlage verwenden**. PLICA legt einen Entwurf an und öffnet den Editor.
2. Sie passen Texte an, ergänzen etwa ein Feld für das Aktenzeichen und prüfen die Regeln, die zum Beispiel die Unternehmensdaten nur bei Unternehmen zeigen ([Kapitel 2](02-formulare-erstellen.md), [Kapitel 3](03-logik.md)).
3. Unter **Design** wählen Sie die Darstellung und die Farbe ([Kapitel 4](04-darstellung.md)).
4. Mit **Vorschau** füllen Sie das Formular probehalber aus. Dabei wird nichts gespeichert.
5. Sie klicken **Veröffentlichen** und kopieren den Link für die Website oder die E-Mail-Signatur ([Kapitel 5](05-veroeffentlichen-teilen.md)).
6. Unter **Automationen** richten Sie eine Eingangsbestätigung und eine Benachrichtigung an das Sekretariat ein ([Kapitel 8](08-automationen.md)).
7. Eingehende Anfragen bearbeiten Sie unter **Antworten** und legen sie als PDF zur Akte ([Kapitel 6](06-antworten.md), [Kapitel 7](07-export-pdf.md)).

## Schneller ans Ziel

- **⌘K** (Windows und Linux: **Strg+K**) öffnet die Befehlspalette („Wohin oder was tun?“). Sie zeigt immer:
  - **Aktionen**: neues Formular, Formular aus Beschreibung (ab Bearbeiter),
  - **Gehe zu**: Formulare, Freigaben, Vorlagen, Einstellungen, Mein Konto und Sicherheit,
  - **Darstellung**: Hell, Dunkel, Wie System,
  - **Formulare**: jedes Formular nach Namen.

  Je nach Seite kommen Befehle hinzu, etwa in den Antworten „Antworten als CSV/Excel exportieren“ und „Nur neue Antworten zeigen“, in einer Antwort die Status-Befehle (Tasten 1–6) und im Editor „Vorschau öffnen“.
- Ein Rechtsklick auf ein Formular in der Liste zeigt alle Aktionen.
- Im Editor zeigt die Taste **?** alle Tastenkürzel.

← [Handbuch](README.md) · weiter: [Formulare erstellen](02-formulare-erstellen.md) →
