# Morgen weiterarbeiten – Pokémon TCG im JUZ Lauf

Stand: 20. Oktober 2026. Dieses Archiv enthält das vollständige lokale Projekt zum Weiterarbeiten, nicht nur ein Deploypaket. Entpacken und den Ordner pokemon-tcg-juz als Projekt öffnen; Änderungen anhand der Quellen bearbeiten und danach dist und Demo neu erzeugen.

## Aufbau und Vorschau

- pokemon-tcg-juz/index.html, theme.css, sync-client.js, bracket-view.js: öffentliche Website und Bedienung.
- server.mjs und tournament-core.mjs: lokale Serverfassung und Turnierlogik.
- netlify/functions/tournament.mjs, netlify.toml, package.json und build.mjs: Onlinebetrieb auf Netlify.
- assets/: Projektbilder; dist/: aktueller veröffentlichungsfähiger Website-Build.
- local-demo/index.html: vollständige Offline-Vorschau als einzelne Datei; direkt im Browser öffnen.
- build-local-demo.mjs: erzeugt die Offline-Vorschau aus den aktuellen Quellen.
- check-*.mjs und checks/: codebasierte Prüfungen; README.md und LOKALE-DEMO.md: weitere Hinweise.
- data/tournament.json: unveränderte lokale Projektdatensicherung. Sie wird nicht automatisch in Netlify übernommen.

Für die Servervorschau Node.js ab Version 22 verwenden: im Projektordner npm start, dann http://127.0.0.1:8765/index.html öffnen. Abhängigkeiten bei Bedarf mit npm install installieren. Für den Onlinebetrieb muss ADMIN_PASSWORD serverseitig in Netlify gesetzt werden (mindestens 12 Zeichen); echte Zugangsdaten gehören nicht ins Projekt. Admin-Hashes und Sitzungen sind bewusst nicht archiviert. Ohne eigene Konfiguration verwendet der lokale Server bei einem frischen Adminzugang das dokumentierte Standardpasswort; bestehende lokale Zugänge werden durch diese Sicherung nicht wiederhergestellt.

## Beschlossene Gestaltung und Funktionen

- Alle öffentlichen Hauptüberschriften sind linksbündig, mit gemeinsamer Größenhierarchie und abgestimmten Abständen; mobil skalieren sie zwischen 25 und 32 Pixeln. Admin- und Rundenüberschriften behalten ihre eigene Hierarchie.
- Drei Turnierregeln: Standardformat; getrennte Junior:innen-/Erwachsenenturniere, je nach Anmeldungen parallel; Hauptrunde und Hoffnungsrunde mit gemeinsamem Finale. Punkt 1 enthält H/I/J und spätere Regelzeichen, Rotation von G, Veröffentlichung/Turnierlegalität sowie Nachdruck-/Errata-Regeln. Originaler Rotation-2026-Link und Regelbuch-Link stehen direkt dort. Kein separater unterer Kartenabschnitt.
- Vor dem Start jeder Gruppe erscheint die ursprüngliche weiße SVG-Beispielgrafik. Danach wird nur der echte Turnierbaum dieser Gruppe gezeigt; Gruppenwechsel berücksichtigt getrennte Startzustände.
- Leihdeckbereich erscheint nur bei vorhandenen Decks. Vormerktexte sind kurz; Text-/Buttonabstände wurden angepasst.
- Gefüllte SVG-Mondsichel und gleich große Sonne für den Theme-Schalter.
- Passwort speichern steht links vor Passwortanzeige und Login; Enter löst den Login einmal aus.
- Offline-Demo-Passwort: TCGCOMMUNITYLAUF. Es steht auf ausdrücklichen Nutzerwunsch sichtbar im Login. Nach explizitem Speichern und erfolgreicher Prüfung wird es im Klartext nur im verwendeten Browser gespeichert. Häkchen und Vorbelegung überstehen Logout/Reload; Logout beendet die Anmeldung tatsächlich. Erneutes Anklicken vergisst das Passwort. Kein IP-Bezug.
- Online werden keine Klartextpasswörter in localStorage abgelegt. Der Browser-Passwortmanager übernimmt die Speicherung; automatische Vorbelegung hängt vom Browser ab. Logout leert diesen Passwortmanager nicht.

## Was dieses Archiv nicht sichert

Live-Netlify-Blobs, Hosting-Einstellungen und Browser-localStorage werden NICHT automatisch gesichert. Demo-Turnierstände und gespeicherte Demo-Passwörter verbleiben im jeweiligen Browser; ein anderer Dateipfad kann einen anderen Speicher verwenden. Das ZIP enthält keine .git-Metadaten, node_modules, echten .env-Dateien, Tokens, admin.json oder Sitzungsdateien. Ein separates Backup der Live-Daten wäre ein eigener Auftrag. Es wurde nichts veröffentlicht und keine Hosting-Einstellung geändert.

## Neu bauen und prüfen

Im Projektordner: node build.mjs und node build-local-demo.mjs.
Danach: node check-rules.mjs, node check-pending-preview.mjs, node check-password-storage.mjs, node check-local-demo.mjs und node check-theme-icon.mjs. Diese Prüfungen liefen erfolgreich mit Code-/DOM-/Storage-Stubs. Keine native Browserprüfung durchgeführt.
