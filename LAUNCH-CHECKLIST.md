# Launch-Checkliste (ehrlich)

Der Code läuft und ist getestet. **Ein öffentlicher Start ist damit noch nicht erlaubt.** Offene Punkte:

## Blocker vor dem Start (außerhalb des Codes)
- [ ] **Rechtstexte**: `public/legal/*` sind Entwürfe. Impressum, Datenschutz, AGB von Anwält:in prüfen lassen, alle [Klammern] füllen, Warnbanner entfernen.
- [ ] **DSGVO**: Dating-Daten sind Art.-9-Daten. Datenschutz-Folgenabschätzung (DSFA), Verarbeitungsverzeichnis, AV-Verträge (Hosting, E-Mail), Löschkonzept inkl. Backups.
- [ ] **Hosting in der EU**, HTTPS, `COOKIE_SECURE=1`, `TRUST_PROXY=1`, `ADMIN_TOKEN` gesetzt, Backups des Volumes `/data` (täglich, getestete Wiederherstellung).
- [ ] **E-Mail-Absender**: Resend-Konto (oder anderer Anbieter), Domain verifiziert (SPF/DKIM), `RESEND_API_KEY`, `MAIL_FROM`.
- [ ] **Moderation**: Wer prüft Selfies und Meldungen, wie schnell (Vorschlag ≤ 24 h)? Ohne Personal nicht starten. Eskalationsweg bei Straftaten festlegen.
- [ ] **Jugendschutz/Alterscheck**: aktuell nur Selbstangabe + Selfie-Sichtprüfung. Rechtlich klären, ob das reicht.
- [ ] **Kontaktstelle (DSA) und Meldeweg für illegale Inhalte** einrichten.

## Fehlt im Produkt (bewusst nicht vorgetäuscht)
- [ ] **Bezahlung**: nicht vorhanden. Optionen: Stripe im Web oder App-Store-Abos (Apple/Google Billing). `PLUS_ENABLED` bleibt aus.
- [ ] **Native Apps / App Stores**: nur PWA. Für Stores z. B. Capacitor-Wrapper, Store-Konten, Review, Datenschutz-Labels, Konto-Löschung in der App (vorhanden).
- [ ] **E-Mail-Bestätigung** bei Registrierung fehlt (Fake-Adressen möglich).
- [ ] **Push-Nachrichten** fehlen (Chat nutzt Polling alle 4 s im offenen Tab).
- [ ] **Automatische Ausweis-/Gesichtsprüfung** fehlt (manuelle Sichtprüfung).
- [ ] **Skalierung**: eine Instanz, SQLite. Bei starkem Wachstum auf Postgres und Redis umbauen.
- [ ] **Monitoring/Alarme** (Uptime, Fehler-Log), `GET /healthz` ist vorhanden.

## Produktannahmen, die nicht belegt sind
- Alle Änderungen aus dem „Nutzerfeedback“ sind **Annahmen**. Ein 1.000-Personen-Test hat nicht stattgefunden.
- Matching-Gewichte, Typen und Texte sind nicht validiert. Studienverweise in der App stammen aus dem Gedächtnis und sollten vor Veröffentlichung geprüft werden.
- Die Ziele (100.000 Nutzer in 60 Tagen, zahlend) hängen an Marketing und Budget, nicht an diesem Paket.

## Vorschlag für einen kontrollierten Start
1. Geschlossene Beta mit 50–200 Personen aus deinem Umfeld (Einladungslinks).
2. Täglich Selfies prüfen, Meldungen lesen, Feedback-Kennzahlen ansehen.
3. Nach 2–3 Wochen: Matching-Gewichte anhand echter Daten anpassen.
4. Erst danach Rechtsprüfung abschließen und öffentlich starten.
