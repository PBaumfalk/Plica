# 28 · Bekannte Einschränkungen

## Betrieb

- **Eine App-Instanz.** Ratenbegrenzung und Login-Drossel liegen im Arbeitsspeicher der App. Mehrere App-Instanzen hinter einem Load Balancer würden die Grenzen je Instanz zählen; ein Neustart setzt sie zurück. Mehrere Worker sind dagegen möglich (Queue mit `SKIP LOCKED`).
- **Kein Healthcheck für den Worker.** `compose.yml` schaltet ihn ab. Ein hängender Worker fällt nur über Logs oder wartende Jobs auf (siehe [Betrieb](25-betrieb-cli.md)).
- **Gescheiterte Jobs bleiben liegen.** Die tägliche Bereinigung entfernt nur erledigte Jobs. Jobs mit Status `dead` oder `failed` bleiben in der Tabelle `jobs`; die Oberfläche zeigt die der letzten 30 Tage.
- **Migrationen nur vorwärts.** Ein Rollback erfolgt über eine Sicherung (siehe [Updates](24-updates.md)).
- **Sicherung ohne gemeinsamen Schnappschuss.** Datenbank und Objektspeicher werden nacheinander gesichert. Eine Wiederherstellung ersetzt die Datenbank in einer Transaktion, die Dateien aber nicht atomar (siehe [Sicherung](23-sicherung.md)).
- **Externe Sicherung und Monitoring** bringt PLICA nicht mit. Beides ist Aufgabe des Betreibers.
- **MinIO:** Die mitgelieferte Konfiguration nutzt RustFS. Vorhandene MinIO-Installationen funktionieren weiter (S3-kompatibel), neue MinIO-Images sind öffentlich nicht mehr erhältlich.
- **`SECRET_KEY`** lässt sich nicht rotieren, ohne verschlüsselte Werte zu verlieren: TOTP-Geheimnisse, Zwischenstände von Fortsetzungslinks, Webhook-Geheimnisse und die ID-Tokens laufender SSO-Sitzungen. Diese müssten danach neu angelegt werden.

## Dateien und Virenprüfung

- **Virenprüfung nur mit ClamAV.** Ohne `CLAMAV_HOST` oder bei nicht erreichbarem Scanner landen Uploads in Quarantäne (Status „ungeprüft“). Berechtigte Personen müssen sie vor dem Öffnen bewusst freigeben. Der Worker prüft solche Uploads stündlich nach, sobald ein Scanner erreichbar ist. `/healthz` zeigt den Zustand im Feld `virusScanner`, meldet aber trotzdem „ok“.
- **Unterschriften** sind einfache elektronische Signaturen (eIDAS Art. 3 Nr. 10) mit Nachweisdaten (Zeitpunkt, Prüfsumme, Formularversion). Eine fortgeschrittene oder qualifizierte Signatur ist nicht implementiert.

## Anmeldung über SSO (OIDC)

- **Ein Anbieter.** PLICA unterstützt genau einen OIDC-Anbieter je Instanz.
- **Rollen aus Gruppen** gelten nur für den Standard-Workspace (den ältesten). Rollen in weiteren Workspaces vergeben Sie in PLICA.
- **Rollenabgleich nur mit Regel.** Die Rolle wird nur angeglichen, wenn die Person in einer Admin-Gruppe ist oder `OIDC_DEFAULT_ROLE` gesetzt ist. Der letzte Inhaber eines Workspace wird nie herabgestuft.
- **Name und E-Mail-Adresse** übernimmt PLICA nur beim Anlegen des Kontos. Spätere Änderungen beim Anbieter kommen nicht an.
- **Kein Back-Channel-Logout.** Wird eine Person beim Anbieter gesperrt, endet eine bestehende PLICA-Sitzung erst mit ihrem Ablauf (14 Tage nach der letzten Nutzung) oder beim Abmelden. Im Team lässt sich die Person sofort entfernen.
- **Lokales TOTP gilt nicht für SSO.** Den zweiten Faktor muss der Anbieter erzwingen.
- **Notzugang:** Fällt der Anbieter aus, setzt `plica reset-password` ein lokales Passwort; bei `LOCAL_LOGIN=hidden` ist die Anmeldung unter `/login?lokal=1` erreichbar.

## E-Mail

- **E-Mail-Versand** setzt einen SMTP-Server voraus. PLICA prüft keine Zustellbarkeit über die Annahme durch den SMTP-Server hinaus.

## Editor und Formulare

- **Editor:** Änderungen werden 0,7 Sekunden nach der letzten Eingabe gespeichert und bis dahin zusätzlich im lokalen Speicher des Browsers abgelegt. Wer den Tab vorher schließt, bekommt die Warnung des Browsers. Ausstehende Änderungen sendet der Browser beim Schließen noch ab, allerdings nur bei Entwürfen unter etwa 60 KB. Bei größeren Entwürfen bietet der Editor die lokale Kopie beim nächsten Öffnen im selben Browser zur Wiederherstellung an.
- **Auswertung:** Quote und Trichter beruhen auf anonymen Browser-Ereignissen. Antworten über die API oder bei blockierten Ereignissen (etwa durch Tracking-Blocker) zählen als Antwort, aber nicht als gemessener Abschluss. Die Auswertung weist beide Zahlen getrennt aus.
- **Fortsetzungslinks:** Die angezeigte Ausfülldauer einer fortgesetzten Antwort misst nur die letzte Sitzung.
- **Einreichungslimit:** Es zählt alle je angenommenen Antworten, auch später gelöschte.

← [Tests](27-tests.md) · [Handbuch](README.md)
