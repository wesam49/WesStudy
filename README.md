# WesStudy v4.0 – Cloud Sync vorbereitet

Neu: Firebase Authentication (E-Mail/Passwort + Google) und Firestore-Cloud-Sync. Die App speichert weiterhin lokal und synchronisiert bei Anmeldung automatisch zusätzlich in die Cloud.

## Einmalige Firebase-Einrichtung
1. Firebase-Projekt erstellen und eine Web-App registrieren.
2. Authentication: Email/Password und Google aktivieren.
3. Authentication > Settings > Authorized domains: `wesam49.github.io` hinzufügen.
4. Firestore-Datenbank erstellen.
5. Inhalt aus `firestore.rules` in Firestore > Rules einsetzen und veröffentlichen.
6. Firebase-Web-Konfiguration in `firebase-config.js` eintragen.
7. Alle Dateien auf GitHub Pages hochladen.

Beim ersten Login: Existieren noch keine Cloud-Daten, wird der aktuelle lokale WesStudy-Stand hochgeladen. Gibt es bereits Cloud-Daten, gleicht die App anhand des lokalen Änderungszeitpunkts ab und fragt bei Konflikten nach.
