# 8 · Automationen und Freigaben

Eine Automation besteht aus einem **Auslöser**, optional einer **Bedingung** und **Schritten** – mit einer zweiten Schrittfolge für den Fall, dass die Bedingung nicht zutrifft.

| Auslöser | Schritte |
|---|---|
| Neue Antwort eingegangen | E-Mail senden |
| Status einer Antwort geändert | Bestätigung an Absender |
| Freigabe erteilt | Webhook auslösen (signiert) |
| Freigabe abgelehnt | Status ändern |
| | Freigabe anfordern |
| | PDF erzeugen |

E-Mail-Texte können Platzhalter (`{{name}}`) und einen Link zur Antwort enthalten.

## Zuverlässigkeit

Automationen laufen im Worker über eine dauerhafte Warteschlange. Schlägt ein Schritt fehl (z. B. Mailserver nicht erreichbar), wird er mit wachsendem Abstand wiederholt. Bereits erledigte Schritte laufen bei einer Wiederholung nicht erneut. Jeder Lauf erscheint im **Protokoll** mit Ergebnis je Schritt. Ein **Testlauf** mit der neuesten Antwort ist jederzeit möglich.

## Webhooks

PLICA sendet JSON per `POST` mit den Kopfzeilen `X-Plica-Signature: t=<unix>,v1=<hex>` (HMAC-SHA256 über `t.body` mit dem Webhook-Geheimnis des Workspace) und einer eindeutigen Zustell-ID für Idempotenz. Adressen in privaten Netzen sind standardmäßig gesperrt. Details: [Integrationen und API](integrationen.md).

## Freigaben

Der Schritt **Freigabe anfordern** legt eine Aufgabe für eine Rolle an. Unter **Freigaben** entscheiden berechtigte Personen mit optionalem Kommentar; die Entscheidung setzt den Status der Antwort und kann weitere Automationen auslösen.

← [Export und PDF](07-export-pdf.md) · weiter: [Team und Rollen](10-team-rollen.md) →
