# WesStudy v4.2 – Google Cloud Sync

Diese Version ist bereits mit dem Firebase-Projekt `wesstudy-1` verbunden.

## Firebase Voraussetzungen
- Google Sign-In: aktiviert
- Authorized Domain: `wesam49.github.io`
- Cloud Firestore: `(default)`
- Firestore-Regeln: Zugriff nur auf `/users/{uid}/...` für den angemeldeten Benutzer

## Erstes Anmelden
1. WesStudy öffnen.
2. Einstellungen öffnen.
3. **Mit Google anmelden** drücken.
4. Beim ersten Login werden vorhandene lokale WesStudy-Daten automatisch in Firestore gespeichert, wenn dort noch keine Cloud-Daten existieren.
5. Danach werden Änderungen automatisch synchronisiert.

## GitHub Pages
Alle Dateien aus diesem ZIP in das Root-Verzeichnis des `WesStudy`-Repositories hochladen und vorhandene Dateien ersetzen.

Zum Umgehen alter Browser-Caches:
`https://wesam49.github.io/WesStudy/?v=4.1`


## v4.4 – Tagesplan
Neue unabhängige Tagesplan-Seite mit Timeline, Kategorien, Wiederholungen, Vorlagen und Tages-Lernziel-Vergleich. Der Tagesplan startet keinen Timer und verändert keine Lernstunden.
