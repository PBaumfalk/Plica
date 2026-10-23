# 28 · Bekannte Einschränkungen

- **Eine App-Instanz.** Ratenbegrenzung und Login-Drossel liegen im Arbeitsspeicher der App. Mehrere App-Instanzen hinter einem Load Balancer würden die Grenzen je Instanz zählen. Mehrere Worker sind dagegen möglich (Queue mit `SKIP LOCKED`).
- **Virenprüfung nur mit ClamAV.** Ohne `CLAMAV_HOST` bleiben Uploads ungeprüft in Quarantäne und müssen vor dem Öffnen bewusst freigegeben werden.
- **Unterschriften** sind einfache elektronische Signaturen (eIDAS Art. 3 Nr. 10) mit Nachweisdaten (Zeitpunkt, Hash, Formularversion). Eine fortgeschrittene oder qualifizierte Signatur ist nicht implementiert.
- **SSO (OIDC)**: Rollen aus Gruppen gelten nur für den Standard-Workspace (den ältesten). Name und E-Mail-Adresse werden nach dem Anlegen nicht mehr vom Anbieter übernommen. Wird eine Person beim Anbieter gesperrt, endet eine bestehende PLICA-Sitzung erst mit ihrem Ablauf oder beim Abmelden (kein Back-Channel-Logout); im Team lässt sich die Person sofort entfernen.
- **Migrationen nur vorwärts.** Rollback erfolgt über eine Sicherung (siehe [Updates](24-updates.md)).
- **E-Mail-Versand** setzt einen SMTP-Server voraus. PLICA prüft keine Zustellbarkeit über den SMTP-Empfang hinaus.
- **MinIO**: Die mitgelieferte Konfiguration nutzt RustFS. Vorhandene MinIO-Installationen funktionieren weiter (S3-kompatibel), neue MinIO-Images sind öffentlich nicht mehr erhältlich.
- **SECRET_KEY** lässt sich nicht rotieren, ohne verschlüsselte Werte (TOTP-Geheimnisse, Zwischenstände, Webhook-Geheimnisse) neu anzulegen.
- **Editor**: Änderungen werden 0,7 Sekunden nach der letzten Eingabe gespeichert. Wer den Tab innerhalb dieser Zeit schließt, bekommt die Warnung des Browsers; ein Speichern beim Schließen gibt es nicht.
- **Auswertung**: Quote und Trichter beruhen auf anonymen Browser-Ereignissen. Antworten über die API oder bei blockierten Ereignissen (z. B. Tracking-Blocker) zählen als Antwort, aber nicht als gemessener Abschluss – die Auswertung weist beide Zahlen getrennt aus.
- **Fortsetzungslinks**: Die Ausfülldauer einer fortgesetzten Antwort misst nur die letzte Sitzung.
- **Einreichungslimit**: Es zählt alle je angenommenen Antworten, auch später gelöschte.

← [Tests](27-tests.md) · [Handbuch](README.md)
