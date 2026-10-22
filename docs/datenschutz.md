# Datenschutz: was PLICA technisch leistet – und was beim Betreiber bleibt

PLICA ist Software. Ob ihr Einsatz rechtmäßig ist, hängt von Zweck, Inhalten der Formulare und Organisation des Betreibers ab. Dieses Dokument trennt die **technischen Möglichkeiten** der Software von den **Pflichten**, die beim Betreiber (Verantwortlicher im Sinne der DSGVO) verbleiben. Es ist keine Rechtsberatung.

## Technische Möglichkeiten

| Thema | Umsetzung |
|---|---|
| Datenhoheit | Vollständig selbst gehostet; keine Cloud-Konten, keine Drittanbieter-Skripte, Schriften lokal ausgeliefert. Optionale KI nur bei ausdrücklicher Konfiguration (`AI_BASE_URL`), z. B. lokal. |
| Datensparsamkeit | Keine IP-Adressen im Klartext (nur tagesgebundener Hash für Missbrauchsschutz); Abbruchanalyse anonym ohne Cookies; versteckte Felder nur mit ausdrücklich freigegebenem URL-Parameter. |
| Speicherbegrenzung | Aufbewahrungsfristen je Workspace und Formular, tägliche endgültige Löschung inklusive Dateien; Löschfristen für verwaiste Uploads, Zwischenstände, Sitzungen und Analyse-Ereignisse (siehe [Handbuch Kap. 12](handbuch/12-datenschutz-aufbewahrung.md)). |
| Betroffenenrechte | Antworten finden (Volltextsuche), exportieren (CSV/XLSX/PDF), einzeln löschen; Workspace-Datenexport. |
| Vertraulichkeit | Rollen und Rechte serverseitig, Workspace-Trennung, Zwei-Faktor-Anmeldung, verschlüsselte Zwischenstände, geschützte Downloads, strikte CSP. |
| Integrität | Unveränderliche Formularversionen je Antwort, Bearbeitungsverlauf, Audit-Log, Prüfsummen für Unterschriften und Sicherungen. |
| Verfügbarkeit | Geprüfte Sicherungen mit Wiederherstellung, dauerhafte Job-Queue mit Wiederholung. |
| Einwilligungen | Feldtyp „Einwilligung“ speichert die Zustimmung zusammen mit dem Wortlaut der Version, der zugestimmt wurde. |
| Unterschriften | **Einfache elektronische Signatur** (eIDAS Art. 3 Nr. 10): Unterschriftsbild mit Zeitpunkt, SHA-256-Prüfsumme, Formularversion und gehashter Netzkennung. Keine fortgeschrittene oder qualifizierte elektronische Signatur – wo das Gesetz Schriftform oder qualifizierte Form verlangt, genügt sie nicht. |

## Pflichten des Betreibers

- **Rechtsgrundlage und Information**: für jedes Formular Zweck und Rechtsgrundlage bestimmen; Datenschutzhinweise (Art. 13 DSGVO) im Formular oder verlinkt bereitstellen.
- **Verzeichnis von Verarbeitungstätigkeiten** (Art. 30 DSGVO) führen.
- **Auftragsverarbeitung**: Mit dem Hoster (z. B. Netcup), externem S3-Speicher und SMTP-Dienst AV-Verträge (Art. 28 DSGVO) schließen.
- **Technische und organisatorische Maßnahmen** (Art. 32 DSGVO) dokumentieren: TLS, Server-Härtung, Updates, Zugriffskonzept, Zwei-Faktor-Pflicht festlegen, Sicherungen extern und verschlüsselt aufbewahren, Wiederherstellung regelmäßig üben, `SECRET_KEY` getrennt sichern.
- **Datenschutz-Folgenabschätzung** (Art. 35 DSGVO) prüfen, insbesondere bei besonderen Kategorien (Art. 9, z. B. Gesundheitsdaten) oder Strafsachen (Art. 10).
- **Löschkonzept**: Fristen fachlich festlegen (z. B. Aufbewahrungspflichten nach § 50 BRAO für Handakten) und in PLICA einstellen.
- **Berufsgeheimnis**: Für Kanzleien § 203 StGB und § 43e BRAO bei Dienstleistern beachten.
- **Virenprüfung** aktivieren oder ungeprüfte Uploads organisatorisch regeln.
- **Meldepflichten** bei Datenpannen (Art. 33/34 DSGVO) organisieren; das Audit-Log unterstützt die Aufklärung.
- **Einbettung**: Wird ein Formular auf einer Website eingebettet, gelten deren Cookie- und Informationspflichten zusätzlich.
