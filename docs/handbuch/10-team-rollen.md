# 10 · Team und Rollen

Dieses Kapitel richtet sich an Inhaber und Administratoren. Es erklärt, wer in PLICA was darf, wie Sie Kolleginnen und Kollegen aufnehmen und wieder entfernen und wie Konten abgesichert sind.

Rollen gelten immer **je Workspace**. Wer in einem Workspace Administrator ist, kann in einem anderen Leser sein (siehe [Workspaces](11-workspaces.md)).

## Die fünf Rollen

| Rolle | Kurz gesagt |
|---|---|
| **Inhaber** | Alles, einschließlich Workspace löschen und Inhaberschaft übertragen. |
| **Administrator** | Mitglieder, Einstellungen, API-Schlüssel und Löschungen. |
| **Bearbeiter** | Formulare bauen, veröffentlichen, automatisieren und exportieren. |
| **Prüfer** | Antworten bearbeiten, kommentieren und Freigaben entscheiden. |
| **Leser** | Formulare und Antworten nur ansehen. |

Die Rechte im Einzelnen:

| Recht | Leser | Prüfer | Bearbeiter | Administrator | Inhaber |
|---|:-:|:-:|:-:|:-:|:-:|
| Formulare und Antworten ansehen | ✓ | ✓ | ✓ | ✓ | ✓ |
| Antworten bearbeiten (Status, Tags, Notizen) | | ✓ | ✓ | ✓ | ✓ |
| Freigaben entscheiden | | ✓ | ✓ | ✓ | ✓ |
| Formulare bauen und ändern | | | ✓ | ✓ | ✓ |
| Formulare veröffentlichen | | | ✓ | ✓ | ✓ |
| Antworten exportieren | | | ✓ | ✓ | ✓ |
| Automationen einrichten | | | ✓ | ✓ | ✓ |
| Formulare löschen | | | | ✓ | ✓ |
| Antworten löschen | | | | ✓ | ✓ |
| Mitglieder einladen, Rollen ändern, entfernen | | | | ✓ ¹ | ✓ |
| Einstellungen → Workspace (Name, Aufbewahrung, Datenexport) | | | | ✓ | ✓ |
| Einstellungen → API und Webhooks | | | | ✓ | ✓ |
| Einstellungen → Protokoll | | | | ✓ | ✓ |
| Workspace löschen | | | | | ✓ |
| Inhaberschaft übertragen | | | | | ✓ |

¹ Administratoren verwalten nur Bearbeiter, Prüfer und Leser. Sie können niemanden zum Administrator machen und andere Administratoren oder den Inhaber weder ändern noch entfernen.

Alle Rechte prüft der Server bei jeder Aktion. Dass eine Schaltfläche ausgeblendet ist, dient nur der Übersicht – wer eine Aktion ohne Recht auslöst, erhält „Dafür fehlt dir die Berechtigung.“

Ihre eigene Rolle sehen Sie unter **Einstellungen** („Du bist …“) und im Workspace-Menü oben in der Seitenleiste.

## Mitglieder verwalten

Unter **Einstellungen → Team** sehen alle Mitglieder die Liste der Personen mit Zugriff auf den Workspace, jeweils mit Rolle, letzter Aktivität („zuletzt aktiv …“ oder „noch nie angemeldet“) und einem Hinweis, ob die Zwei-Faktor-Anmeldung aktiv ist.

Inhaber und Administratoren ändern die **Rolle** direkt über das Auswahlfeld neben einer Person. Das Menü **⋯** daneben enthält

- **Inhaberschaft übertragen …** (nur für Inhaber, siehe unten),
- **Aus dem Workspace entfernen …** – die Person verliert sofort den Zugriff auf alle Formulare und Antworten dieses Workspace. Laufende Sitzungen verlieren den Workspace beim nächsten Seitenaufruf. Das Konto selbst bleibt bestehen, ebenso Mitgliedschaften in anderen Workspaces.

Die eigene Rolle können Sie nicht selbst ändern.

## Personen einladen

1. **Einstellungen → Team → Person einladen** öffnen.
2. E-Mail-Adresse und Rolle wählen. Administratoren stehen nur Bearbeiter, Prüfer und Leser zur Wahl, Inhabern zusätzlich Administrator.
3. Optional **Einladung per E-Mail senden** anhaken. Das geht nur, wenn die IT den E-Mail-Versand eingerichtet hat (`SMTP_URL`, siehe [Konfiguration](21-konfiguration.md)). Sonst ist das Kästchen ausgegraut.
4. **Einladen** wählen.

PLICA zeigt danach den **Einladungslink** an – nur dieses eine Mal. Kopieren Sie ihn und geben Sie ihn ausschließlich an die eingeladene Person weiter.

Regeln für Einladungen:

- Der Link ist **7 Tage** gültig und nur **einmal** verwendbar.
- Die Person muss sich mit **genau dieser E-Mail-Adresse** anmelden oder registrieren. Ist sie mit einer anderen Adresse angemeldet, bietet PLICA „Abmelden und neu anmelden“ an.
- Hat die Person noch kein Konto, legt sie über den Link Name und Passwort fest („Konto anlegen und beitreten“). Hat sie schon eines, meldet sie sich an, öffnet den Link erneut und wählt **Einladung annehmen**.
- Eine neue Einladung an dieselbe Adresse ersetzt die offene alte.
- Offene Einladungen stehen unter **Offene Einladungen** und lassen sich dort **zurückziehen**.
- Wer bereits Mitglied ist, kann nicht erneut eingeladen werden.

Mit SSO gilt für den Standard-Workspace etwas anderes, siehe [Rollen bei Anmeldung über SSO](#rollen-bei-anmeldung-über-sso).

## Inhaberschaft übertragen

Jeder Workspace hat einen Inhaber. Inhaber wird man nur auf zwei Wegen: durch Anlegen des Workspace oder durch Übertragung. Über das Rollen-Auswahlfeld oder eine Einladung lässt sich niemand zum Inhaber machen.

So übertragen Sie die Inhaberschaft:

1. **Einstellungen → Team**, im Menü der künftigen Inhaberin **Inhaberschaft übertragen …** wählen.
2. Mit **Übertragen** bestätigen.

Die Person wird Inhaber. Sie selbst werden **Administrator** und können den Workspace danach nicht mehr löschen. Der Vorgang steht im Protokoll.

## Der letzte Inhaber ist geschützt

Damit ein Workspace nie ohne Inhaber bleibt, verhindert PLICA:

- das Herabstufen des letzten Inhabers („Der letzte Inhaber kann nicht herabgestuft werden.“),
- das Entfernen des letzten Inhabers,
- dass der letzte Inhaber den Workspace verlässt. Die Schaltfläche **Workspace verlassen …** erscheint für ihn gar nicht; er muss zuerst die Inhaberschaft übertragen.

Auch der Abgleich mit SSO-Gruppen stuft den letzten Inhaber nie herab.

## Workspace verlassen

Alle anderen Mitglieder können unter **Einstellungen → Team → Workspace verlassen …** selbst gehen. Der Zugriff endet sofort. Wer zurück möchte, braucht eine neue Einladung.

## Rollen bei Anmeldung über SSO

Ist die Anmeldung über authentik eingerichtet (siehe [Konfiguration](21-konfiguration.md#anmeldung-über-authentik-oidc)), gilt für den **Standard-Workspace** eine Besonderheit. Standard-Workspace ist der **älteste** Workspace der Installation – in der Regel der bei der Ersteinrichtung angelegte.

Bei **jeder** Anmeldung über SSO setzt PLICA dort die Rolle anhand der authentik-Gruppen:

- Mitglied einer Admin-Gruppe (`OIDC_ADMIN_GROUPS`) → **Administrator**.
- Sonst → die Standardrolle aus `OIDC_DEFAULT_ROLE` (z. B. Bearbeiter).
- Ist keine Standardrolle gesetzt und die Person in keiner Admin-Gruppe, ändert PLICA nichts.

Ist die Person noch nicht Mitglied des Standard-Workspace, nimmt PLICA sie dabei mit dieser Rolle auf. Im Protokoll steht dann „Workspace beigetreten · über SSO“ bzw. „Rolle aus SSO-Gruppen übernommen“.

Was das für Ihre Arbeit unter **Einstellungen → Team** bedeutet:

- **Rollenänderungen halten nicht.** Stufen Sie im Standard-Workspace eine Person von Bearbeiter auf Prüfer herab, setzt die nächste SSO-Anmeldung sie wieder auf die Standardrolle. Dauerhaft ändern Sie Rollen dort nur über die Gruppen in authentik. Feinere Abstufungen (einzelne Prüfer oder Leser) sind im Standard-Workspace nur möglich, wenn `OIDC_DEFAULT_ROLE` leer bleibt.
- **Entfernen hält nicht.** Wer aus dem Team entfernt wird, aber weiter in authentik zugelassen ist, ist nach der nächsten SSO-Anmeldung wieder Mitglied. Den Zugang sperren Sie in authentik (Gruppe aus `OIDC_ALLOWED_GROUPS` entziehen oder Konto deaktivieren).
- **Admin-Gruppe entzogen.** Verliert ein Administrator die Admin-Gruppe, erhält er bei der nächsten Anmeldung die Standardrolle. Ist keine Standardrolle gesetzt, **bleibt er Administrator** – stufen Sie ihn dann zusätzlich von Hand herab.
- **Inhaber.** Ein Inhaber in einer Admin-Gruppe bleibt Inhaber. Der letzte Inhaber wird nie herabgestuft. Nach einer Übertragung ist der frühere Inhaber Administrator; ohne Admin-Gruppe erhält er bei der nächsten Anmeldung die Standardrolle.
- **Weitere Workspaces** sind vom Abgleich nicht betroffen. Dort vergeben Sie Rollen wie gewohnt über Einladungen, und Änderungen bleiben bestehen.
- **Einladungen für SSO-Konten.** Die Person meldet sich zuerst über SSO an und öffnet dann den Einladungslink. Gibt es für sie noch kein Konto und legt PLICA Konten nicht automatisch an (`OIDC_AUTO_CREATE_USERS`), registriert sie sich über den Link mit Passwort. Bei der ersten SSO-Anmeldung verknüpft PLICA das Konto über die bestätigte E-Mail-Adresse.

**Ausscheiden einer Person mit SSO-Konto:** Entziehen Sie den Zugang in authentik **und** entfernen Sie die Person in PLICA aus jedem Workspace. Das Sperren in authentik allein verhindert nur neue SSO-Anmeldungen. Bestehende PLICA-Sitzungen laufen weiter, bis sie ablaufen, und ein Konto, das vor der Verknüpfung ein Passwort hatte, kann sich damit weiterhin über `/login?lokal=1` anmelden. Erst das Entfernen aus dem Workspace beendet den Zugriff sofort. Ein vergessenes Passwort lässt sich nur auf dem Server zurücksetzen (`plica reset-password`, siehe [Betrieb und Kommandozeile](25-betrieb-cli.md)); dabei werden alle Sitzungen des Kontos beendet.

## Konto und Sicherheit

Unter **Einstellungen → Konto** verwaltet jede Person ihr eigenes Konto.

**Profil.** Name und E-Mail-Adresse. Der Name erscheint in Notizen, im Verlauf von Antworten und im Protokoll. Eine neue E-Mail-Adresse verlangt das aktuelle Passwort.

**Passwort.** Mindestens 10, höchstens 200 Zeichen. Abgelehnt werden sehr verbreitete Passwörter und solche, die den Namensteil der E-Mail-Adresse enthalten. Nach einer Änderung beendet PLICA alle anderen Sitzungen.

**Zwei-Faktor-Anmeldung.** Zusätzlich zum Passwort fragt PLICA nach einem sechsstelligen Code aus einer Authenticator-App (TOTP, z. B. 1Password, Aegis, Google Authenticator):

1. **Einrichten** wählen und den QR-Code mit der App scannen.
2. Den Code aus der App eingeben und **Bestätigen und aktivieren** wählen.
3. Die **acht Wiederherstellungscodes** sichern (**Als Textdatei speichern** oder **Kopieren**), dann **Gespeichert** wählen. Die Codes werden nur jetzt angezeigt. Jeder Code funktioniert genau einmal und ersetzt den App-Code, wenn das Telefon nicht verfügbar ist.

**Deaktivieren …** verlangt das Passwort. PLICA kann sie nicht für alle erzwingen. Ob sie Pflicht ist, legen Sie organisatorisch fest; in der Mitgliederliste sehen Sie, wer sie aktiviert hat. Für das Inhaberkonto ist sie dringend zu empfehlen.

Konten, die über SSO angelegt wurden, haben in PLICA kein Passwort. Statt Passwort und Zwei-Faktor zeigt die Kontoseite dann den Abschnitt **Anmeldung**; den zweiten Faktor erzwingt authentik.

**Angemeldete Geräte.** Die Liste zeigt alle aktiven Sitzungen mit Browser, Betriebssystem und letzter Aktivität. Unbekannte Sitzungen beenden Sie einzeln mit **Abmelden** oder mit **Alle anderen Geräte abmelden**. Die aktuelle Sitzung beenden Sie über das normale Abmelden. Eine Sitzung läuft nach 14 Tagen ohne Nutzung ab; bei Nutzung verlängert sie sich.

**Schutz vor Passwortraten.** Ab dem fünften Fehlversuch für dieselbe Adresse oder vom selben Netz sperrt PLICA die Anmeldung kurz, mit jedem weiteren Fehlversuch doppelt so lange, höchstens 15 Minuten. Nach 30 Minuten ohne Fehlversuch beginnt die Zählung neu. Ein Neustart der Anwendung setzt die Zähler zurück.

## Protokoll

Unter **Einstellungen → Protokoll** (Administratoren und Inhaber) steht, wer wann was im Workspace getan hat – ohne Inhalte von Antworten. Sie filtern nach **Aktion**, **Person** sowie **Von** und **Bis**. Erfasst werden unter anderem:

- Einladungen, Beitritte, Rollenänderungen (auch aus SSO-Gruppen), Entfernen und Verlassen, Übertragung der Inhaberschaft,
- Änderungen an Formularen (angelegt, veröffentlicht, pausiert, archiviert, gelöscht, Version wiederhergestellt),
- gelöschte Antworten, auch durch die automatische Aufbewahrung,
- Datenexporte und Änderungen der Workspace-Einstellungen,
- API-Schlüssel und Webhook-Geheimnis,
- Freigabe-Entscheidungen,
- Passwortänderungen und Ein- oder Ausschalten der Zwei-Faktor-Anmeldung.

Anmeldungen, Fehlversuche, beendete Sitzungen und Profiländerungen gehören zum Konto, nicht zu einem Workspace. PLICA speichert sie ebenfalls, zeigt sie aber im Protokoll eines Workspace nicht an. Bei Bedarf wertet die IT sie in der Datenbank aus (Tabelle `audit_log`).

← [Automationen](08-automationen.md) · weiter: [Workspaces](11-workspaces.md) →
