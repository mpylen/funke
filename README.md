# Funke – Release-Kandidat 1.0

Web-App (PWA) mit eigenem Server. Keine npm-Abhängigkeiten, nur **Node.js ≥ 22.5** (nutzt `node:sqlite`).

## Was drin ist (echt, getestet)
Konten (scrypt-Passwörter, Cookie-Sitzungen), Passwort-Reset per E-Mail, Onboarding mit Typ-Berechnung, Fotos + Selfie-Upload,
manuelle Foto-Freigabe (Admin), tägliche Vorschläge mit Begründung, Funken → gegenseitiges Match → Chat (max. 5 offen),
Gesprächskarten, Date-Vorschlag, freundliches Beenden, Melden/Blockieren, Wingman-Empfehlungen per Link (ohne Konto),
Einladungslink mit Bonus-Vorschlägen, Datenexport, Konto löschen, Admin-Bereich, Sicherheits-Header (CSP), Rate-Limits, PWA.

## Was NICHT drin ist
Siehe `LAUNCH-CHECKLIST.md`. Kurz: keine Bezahlung, keine native App, kein Push, keine E-Mail-Bestätigung, keine automatische Ausweisprüfung, Rechtstexte sind Entwürfe.

## Starten
```bash
ADMIN_TOKEN=$(openssl rand -hex 32) npm start        # http://localhost:3000
npm test                                              # API-Tests
```
Docker:
```bash
docker build -t funke .
docker run -p 3000:3000 -v funke-data:/data --env-file .env funke
```
Hinter einem HTTPS-Proxy (Caddy, nginx, Fly.io, Render …) `COOKIE_SECURE=1` und `TRUST_PROXY=1` setzen. Variablen: `.env.example`.
**Nur eine Instanz betreiben** (SQLite, Rate-Limits im Speicher). Das Volume `/data` regelmäßig sichern.

## Admin
`https://<deine-domain>/admin`, Anmeldung mit `ADMIN_TOKEN`. Dort: Selfies/Fotos prüfen (Freigeben/Ablehnen), Meldungen bearbeiten (Sperren/Erledigt), Kennzahlen und Feedback-Mittelwerte.
Ohne Freigabe sieht niemand ein neues Profil und bekommt niemand Vorschläge. Plane täglich Zeit für die Prüfung ein.

## Struktur
`server/server.js` API + Matching + statische Dateien · `public/` App, Wingman-Seite, Admin, Rechtstexte, Schriftarten (selbst gehostet) · `test/api.test.js`.

## Matching (Annahmen, nicht validiert)
Gewichte in `score()`/`eligible()` sind Annahmen aus der Literatur und ungeprüft. Erst echte Daten (Funken-Quote, Chat-Quote, Dates) zeigen, ob sie stimmen. Kennzahlen: Admin → Kennzahlen.

## Online stellen (empfohlen: Fly.io, Frankfurt)
1. `fly.toml`: `funke-CHANGE-ME` durch einen freien Namen ersetzen (zweimal).
2. `fly launch --no-deploy --copy-config`, dann `fly volumes create funke_data --size 1 --region fra`.
3. `fly secrets set ADMIN_TOKEN=$(openssl rand -hex 32)` (Token notieren), dann `fly deploy`.
Alternative: `render.yaml` (Render Blueprint). Eine Instanz, Volume ist Pflicht, sonst gehen Daten bei Neustart verloren.
