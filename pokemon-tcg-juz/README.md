# Pokémon TCG Tag im JUZ – gemeinsame Turnierverwaltung

## Netlify (mit GitHub verbunden)

1. Alle Dateien dieses Pakets einschließlich `netlify/` in das Hauptverzeichnis deines GitHub-Repositories hochladen. Vorhandene gleichnamige Dateien ersetzen.
2. In Netlify unter Project configuration → Environment variables die Variable `ADMIN_PASSWORD` mit deinem eigenen Passwort (mindestens 12 Zeichen) anlegen. Für Functions bzw. alle Bereiche verfügbar machen. Das Passwort niemals in GitHub eintragen.
3. Neu deployen. Die netlify.toml legt Build-Befehl `npm run build` und Veröffentlichungsordner `dist` fest. Ein früher eingestelltes Base directory muss auf diesen Projektordner zeigen.
4. Auf der Website den Adminbereich öffnen und mit diesem Passwort anmelden.

Netlify Functions und Netlify Blobs speichern die Daten gemeinsam. Alle geöffneten Seiten aktualisieren sich ungefähr alle drei Sekunden; in ausgeblendeten Tabs pausieren die Abfragen. Anmeldungen, Gruppenwechsel, Namen, Datum/Uhrzeit, Paarungen, Freilose, Ergebnisse sowie Leihdeck-Bestand und Reservierungen werden zentral gespeichert. Gleichzeitige Änderungen werden mit bedingten Schreibzugriffen zusammengeführt. Bei kollidierenden Ergebnisänderungen muss die Turnierleitung erneut bestätigen.

Junioren und Erwachsene starten leer. Alte Anmeldungen aus der rein lokalen Demo werden nicht automatisch übernommen. Daten bleiben bei einem neuen Deploy derselben Netlify-Site bestehen. Vorschau-Deploys derselben Site verwenden denselben Speicher; für Experimente eine getrennte Netlify-Site verwenden.

Die Bearbeitung eigener Anmeldungen wird durch ein geschütztes Browser-Cookie ermöglicht. Nach Löschen der Cookies oder auf einem anderen Gerät muss der Admin helfen. Admin-Sitzungen laufen nach acht Stunden ab. Admin-Passwortänderungen machen bestehende Online-Sitzungen ungültig.

## Leihdecks

Im Admin-Bereich lassen sich Leihdecks mit Namen und Stückzahl eintragen (bis zu 20 Exemplare pro Eintrag). Besucher sehen die verfügbaren Exemplare und können pro Browser eine Reservierung vornehmen oder stornieren. Reservierte Decks bleiben im Bestand sichtbar und können erst entfernt werden, wenn die Reservierung aufgehoben ist. Die Website weist darauf hin, dass es sich um eine begrenzte Auswahl einfacher Decks handelt und die Verfügbarkeit nicht garantiert ist.

## Lokale Vorschau

Node.js ab Version 22 installieren, im Projektordner `npm start` ausführen und http://127.0.0.1:8765/index.html öffnen. Der lokale Server ist ausschließlich an diesen Computer gebunden. Beim erstmaligen lokalen Start ohne gespeicherten Adminzugang lautet das Admin-Passwort standardmäßig `TCGCOMMUNITYLAUF`. Ein bereits gespeicherter Adminzugang bleibt erhalten; `ADMIN_PASSWORD` hat immer Vorrang, auch beim Hosting.

Lokale Daten liegen im Ordner `data/`. Mehrere Browser auf diesem Computer sehen denselben Stand. Dieser lokale Speicher ist getrennt vom Netlify-Speicher. Die Einzeldatei index.html allein reicht für die Synchronisierung nicht aus.

## Enthaltene Dateien

- index.html: bestehende Website mit unverändertem Design
- sync-client.js: API-Zugriffe und automatische Aktualisierung
- netlify/functions/tournament.mjs: Online-API mit Zugriffskontrolle
- tournament-core.mjs: Turnierlogik für die Online-API
- server.mjs: eigenständige lokale Vorschau
- netlify.toml, package.json, build.mjs: Netlify-Build und Konfiguration

Nicht veröffentlicht und nicht auf Netlify live geprüft. Codebasierte Prüfungen: `node check-local-demo.mjs` und `node check-password-storage.mjs`; keine native Browserprüfung. Netlify-Nutzung unterliegt den Limits und Kosten des eigenen Tarifs. Ein alter GitHub-Pages-Workflow ist für diese Version ungeeignet; verwende Netlify als Hosting.

Paarungen: Runde 1 wird ausgelost. Bei gerader Zahl der Weiterkommenden werden anschließend benachbarte Sieger im festen Baum gepaart. Bei ungerader Zahl bleiben Zufallsauslosung und Freilos aktiv. bracket-view.js zeigt feste Folgerunden vorab und zeichnet Verbindungen anhand der tatsächlichen Paarungen.

Upper Bracket und Lower Bracket laufen parallel. Verlierer vollständig entschiedener Upper-Bracket-Runden steigen im Lower Bracket ein, sobald mindestens zwei Personen für eine Begegnung bereitstehen. Beide Brackets haben einen eigenen Sieger. Korrekturen im Upper Bracket setzen nachfolgende Lower-Bracket-Runden nach Bestätigung zurück. Bei zufälligen Folgepaarungen werden keine Verbindungslinien gezeichnet.

Paarungslogik: Das Lower Bracket wird automatisch angelegt. Sobald eine Runde vollständig entschieden ist, wird die nächste automatisch vorbereitet. Bei bereits abgeschlossenen Alt-Turnieren bleibt der Startknopf als Übernahme verfügbar. Feste Verbindungen treffen mittig und symmetrisch auf den Nachfolgekasten.

Parallelbetrieb: Verlierer aus abgeschlossenen Upper-Bracket-Runden steigen automatisch ins Lower Bracket ein, sobald keine vorherige Begegnung mehr offen ist. Spätere Verlierer werden mit den verbleibenden Lower-Bracket-Spielern gepaart. Laufende Paarungen bleiben bestehen. Bei neu hinzukommenden Spielern werden keine festen Verbindungslinien behauptet. Nach dem Upper-Bracket-Finale und allen Lower-Bracket-Runden stehen beide Finalisten fest.

Automatische Runden: Der Admin startet das Turnier einmal. Sobald die parallel laufenden Begegnungen im Upper Bracket und Lower Bracket entschieden sind, werden die nächsten Paarungen samt Freilosen vorbereitet. Im Turnierbaum erscheint eine feste Pause von 10 Minuten mit Countdown. Danach werden beide Brackets automatisch gemeinsam freigeschaltet. Der angemeldete Admin kann die Pause über den Button „Pause skippen“ vorzeitig beenden. Der Server übernimmt den Start für alle Besucher, auch wenn der Admin nicht angemeldet bleibt.

Finale: Sobald Upper-Bracket-Sieger und Lower-Bracket-Sieger feststehen, erscheint das große Finale nach derselben 10-minütigen Pause. Der Admin trägt dort das Endergebnis ein.

## Passwort speichern

Der Speicherbutton steht links vor Passwortanzeige und Login. Nach erfolgreicher Passwortprüfung merkt sich die Onlinefassung nur die nicht geheime Auswahl browserlokal (Häkchen/aria-pressed) und fragt einmalig den Browser-Passwortmanager über die Credential Management API an. Ohne Unterstützung erklärt die Seite die native Passwortmanager-Option. Ob und wann ein Passwort vorbefüllt wird, entscheidet der Browser; eine zuverlässige automatische Vorbelegung kann die Website nicht erzwingen. Logout beendet die Sitzung und leert den Passwortmanager nicht. Abschalten entfernt die lokale Auswahl; bereits im Passwortmanager gespeicherte Zugangsdaten müssen dort gelöscht werden. Es werden keine Klartextpasswörter in localStorage gespeichert.

Die Offline-Demo speichert nach expliziter Auswahl und erfolgreicher Prüfung das öffentliche Demo-Passwort nur in diesem Browser. Logout und Neuladen erhalten Passwort und Häkchen, starten aber keine neue Anmeldung. Erneutes Anklicken vergisst die gespeicherten Daten. Details in LOKALE-DEMO.md.

Die öffentliche Vorschau vor Turnierstart verwendet wieder die ursprüngliche eingebettete SVG-Grafik aus `work/html-preview/index.html` mit dem vorhandenen farbigen Hintergrund. Je Gruppe wird sie nur angezeigt, solange noch keine echte Runde existiert. Teilnehmer und Ergebnisse werden dafür nicht verändert. Prüfung: `node check-pending-preview.mjs` (beide Gruppen vor/nach Start, gemischte Startzustände, Gruppenwechsel und Reset; Original-SVG identisch).

Aktueller Stand: Die Karten-Zulässigkeit und beide offiziellen Links stehen vollständig in Regel 1. Alle öffentlichen Hauptüberschriften sind auf Nutzerwunsch wieder linksbündig und einheitlich gestaltet. Frühere Hinweise zur zentrierten Überschrift oder separaten Kartenübersicht sind damit überholt. Fortsetzung und Sicherungsgrenzen: WEITERARBEITEN.md.
