# PLICA – Handbuch

Dieses Handbuch beschreibt PLICA in drei Teilen: die tägliche Arbeit mit Formularen und Antworten (Teil A), die Verwaltung von Team, Workspaces und Datenschutz (Teil B) und Installation und Betrieb für die IT (Teil C).

| Sie möchten … | Kapitel |
|---|---|
| sich zurechtfinden und anmelden | [1](01-ueberblick.md) |
| ein Formular bauen und veröffentlichen | [2](02-formulare-erstellen.md), [5](05-veroeffentlichen-teilen.md) |
| Felder abhängig von Antworten zeigen oder Beträge berechnen | [3](03-logik.md) |
| ein Formular auf der Kanzlei-Website einbetten | [5](05-veroeffentlichen-teilen.md) |
| Antworten bearbeiten, exportieren oder als PDF ablegen | [6](06-antworten.md), [7](07-export-pdf.md) |
| Bestätigungen, Freigaben und Übergaben an j-lawyer automatisieren | [8](08-automationen.md), [Integrationen](integrationen.md) |
| Kolleginnen und Kollegen einladen und Rechte vergeben | [10](10-team-rollen.md) |
| Aufbewahrungsfristen festlegen | [12](12-datenschutz-aufbewahrung.md) |
| PLICA installieren, an authentik anbinden und betreiben | [20](20-installation.md) bis [28](28-bekannte-einschraenkungen.md) |

## Teil A – Arbeiten mit PLICA

1. [Überblick](01-ueberblick.md) – Anmeldung, Oberfläche, der Weg eines Formulars
2. [Formulare erstellen](02-formulare-erstellen.md) – Editor, Feldtypen, Seiten, Vorlagen und Bausteine, Versionen
3. [Bedingte Logik und Berechnungen](03-logik.md) – Regeln, Bedingungen, Formeln
4. [Darstellung: Classic, Cards, Wizard](04-darstellung.md) – Anzeigemodi, Farben, Schrift
5. [Veröffentlichen und Teilen](05-veroeffentlichen-teilen.md) – Link, QR-Code, Einbettung, Schutz und Fristen
6. [Antworten bearbeiten](06-antworten.md) – Tabelle, Detailansicht, Status, Notizen, Ansichten
7. [Export und PDF](07-export-pdf.md) – CSV, XLSX, JSON und PDF-Vorlagen
8. [Automationen und Freigaben](08-automationen.md) – E-Mails, Webhooks, Freigaben, Zustellprobleme

## Teil B – Administration

10. [Team und Rollen](10-team-rollen.md) – Rollen, Einladungen, Inhaberschaft, Rollen aus authentik-Gruppen
11. [Workspaces](11-workspaces.md) – mehrere Bereiche in einer Installation
12. [Datenschutz und Aufbewahrung](12-datenschutz-aufbewahrung.md) – Fristen und endgültige Löschung

## Teil C – Für die IT

20. [Installation](20-installation.md) – Docker Compose, Ersteinrichtung, Virenscanner
21. [Konfiguration](21-konfiguration.md) – alle Umgebungsvariablen, E-Mail, [Anmeldung über authentik](21-konfiguration.md#anmeldung-über-authentik-oidc)
22. [Reverse Proxy](22-reverse-proxy.md) – Caddy und nginx, eigene Formular-Domain, Verwaltung nur intern
23. [Sicherung und Wiederherstellung](23-sicherung.md)
24. [Updates und Rollback](24-updates.md)
25. [Betrieb und Kommandozeile](25-betrieb-cli.md) – Befehle, Logs, Healthcheck, Überwachung
26. [Architektur](26-architektur.md)
27. [Tests](27-tests.md)
28. [Bekannte Einschränkungen](28-bekannte-einschraenkungen.md)

Weitere Dokumente: [Integrationen: REST-API und Webhooks](integrationen.md) · [Sicherheit (OWASP ASVS)](../sicherheit/asvs.md) · [Datenschutz](../datenschutz.md)
