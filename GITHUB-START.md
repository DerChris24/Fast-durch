# Website auf GitHub und Netlify einrichten

Dieses Paket enthält den aktuellen Stand vom 21. Oktober 2026: Website, Synchronisation, Admin-Anmeldung, gemeinsame Datenspeicherung über Netlify Blobs, lokale Serveralternative, Offline-Demo und Prüfskripte.

## Einmal einrichten

1. Die ZIP-Datei entpacken. ALLE enthaltenen Dateien und Ordner direkt ins Hauptverzeichnis deines GitHub-Repositories laden, einschließlich netlify/, package.json, netlify.toml und tournament-core.mjs. Die ZIP selbst nicht einfach als einzelne Datei hochladen. Ein eventuell noch vorhandener alter GitHub-Pages-Workflow .github/workflows/deploy-pages.yml ist für diese Fassung nicht nötig und sollte entfernt/deaktiviert werden.
2. In Netlify das GitHub-Repository als Projekt verbinden. netlify.toml enthält bereits den Buildbefehl npm run build, den Ausgabeordner dist und die Function-Konfiguration. Liegen die Dateien im Repository-Hauptverzeichnis, bleibt das Base directory leer.
3. In Netlify serverseitig die Umgebungsvariable ADMIN_PASSWORD setzen, für Functions verfügbar. Wenn du das bisher gewünschte Passwort verwenden möchtest, lautet der Wert TCGCOMMUNITYLAUF. Dieses Passwort gehört NICHT in das öffentliche Online-HTML oder eine echte .env-Datei im Repository. Du kannst stattdessen ein eigenes Passwort mit mindestens 12 Zeichen setzen.
4. Danach deployen bzw. erneut deployen. Die Netlify-Adresse öffnen und dort die Anmeldung testen. GitHub Pages allein bietet weder die API noch den gemeinsamen Datenspeicher.

Die gemeinsame Speicherung wird von der enthaltenen Netlify Function über Netlify Blobs angelegt. Kein zusätzlicher Datenbank-Server und keine im Browser hinterlegten Hosting-Tokens sind erforderlich. Netlify-Konto und passende Dienstverfügbarkeit bleiben Voraussetzung.

## Was enthalten ist

- index.html, theme.css, sync-client.js, bracket-view.js: aktuelle Online-Oberfläche.
- tournament-core.mjs: gemeinsame Turnierlogik.
- netlify/functions/tournament.mjs: API, geschützte Admin-Sitzungen und persistente gemeinsame Speicherung.
- package.json, netlify.toml, build.mjs: Installation und Build für Netlify.
- assets/ und dist/: Projektbilder und aktueller Website-Build. Der Build erzeugt dist erneut.
- server.mjs: alternative lokale Servervorschau, npm start, http://127.0.0.1:8765/index.html (Node.js ab 22).
- local-demo/index.html: eigenständige Offline-Vorschau. Sie synchronisiert NICHT mit der Online-Seite.
- build-local-demo.mjs und check-*.mjs: Demo-Generator und codebasierte Prüfungen.

## Daten und Zugang

Vorhandene Live-Netlify-Daten werden nicht aus dem Chat exportiert. Beim Deploy auf dieselbe Netlify-Site bleibt deren bestehender Blobs-Speicher erhalten; eine neue Site beginnt mit eigenem Speicher. Lokale Browserdaten und Offline-Demo-Anmeldungen werden nicht automatisch übernommen. Lokale data/-Dateien, Admin-Hashdateien und bestehende Sitzungen sind nicht Bestandteil dieses Uploadpakets. Die Funktionen zum Speichern und Anmelden sind vollständig enthalten; das Online-Adminpasswort wird über ADMIN_PASSWORD konfiguriert.

Die Offline-Demo zeigt ihr öffentliches Demo-Passwort auf ausdrücklichen Nutzerwunsch an und kann es nach Auswahl nur im jeweiligen Browser speichern. Die Onlinefassung nutzt den Browser-Passwortmanager und speichert keine Klartextpasswörter in localStorage. Abmelden beendet die Sitzung.

## Prüfung

Codebasierte Prüfungen umfassen Admin-Aktionen, Interessen, Leihdecks, Anmeldung, Turnierablauf, Hoffnungsrunde/Finale, Reset/Zurückspulen, Podest, Großansicht und Konsistenz der Builds. Kein aktueller Live-Netlify-Test und keine visuelle Browserprüfung durchgeführt. Es wurde nichts veröffentlicht und kein Hosting-Konto verändert.
