# Lokale Demo

`local-demo/index.html` direkt per Doppelklick im Browser öffnen. Kein Server nötig. Die Datei enthält Gestaltung, Turnierlogik und alle Skripte.

Admin-Passwort: **TCGCOMMUNITYLAUF** (ausschließlich Demo, kein geschützter Online-Zugang).

Anmeldungen, Interesse, Eventdaten, Leihdecks und Turnierstände werden unter `pokemon-juz-local-demo-v1` im lokalen Browser-Speicher gesichert. Browserdaten müssen erlaubt sein; anderer Browser oder anderer Dateipfad kann einen eigenen Speicher verwenden. Admin-Anmeldung gilt nur bis zum Neuladen. „Passwort speichern“ prüft das eingegebene Passwort und speichert es nach erfolgreicher Anmeldung im Klartext ausschließlich in diesem Browser. Das Häkchen bleibt nach Abmelden und Neuladen aktiv; das Loginfeld wird wieder vorbefüllt, ohne automatisch anzumelden. Erneutes Anklicken vergisst das Passwort. Ungültige oder veraltete gespeicherte Werte werden entfernt. Browserdaten-Löschen entfernt auch die Auswahl. Bei deaktiviertem/vollen Speicher wird eine Änderung nicht als erfolgreich bestätigt.

Die Serverfassung nutzt ein standardkonformes Loginformular und den Browser-Passwortmanager, ohne Klartextpasswörter in localStorage abzulegen. Für den späteren gemeinsamen Betrieb sind weiterhin Backend, gemeinsame Datenbank und echte Admin-Anmeldung erforderlich. Die Demo überträgt ihre Daten nicht automatisch auf die Online-Seite.

Neu erzeugen: `node build-local-demo.mjs` im Projektordner. Prüfen: `node check-local-demo.mjs` und `node check-password-storage.mjs`.

Geprüft: Syntax sämtlicher eingebetteter Skripte, Anmeldung, PIN-Prüfung, Eventdaten, Leihdeckanlage, Turnierstart, Siegerauswahl und Wiederherstellung gespeicherter Daten. Speichern, Logout, erneutes Rendern, neuer JavaScript-Kontext mit gleichem Speicher, späterer Login ohne Neueingabe, Opt-out, falsche/veraltete Passwörter, blockierter Speicher, Buttonreihenfolge und Enter-Submit wurden codebasiert mit DOM-/Storage-Stubs geprüft. Keine native Browserprüfung durchgeführt. Es wurde nichts veröffentlicht.

Im Login zeigt die Augen-Schaltfläche nur das eingegebene Passwort an und verbirgt es wieder.
