WesStudy v5.4.4

Änderungen:
- Wochenstatus: Gelb bei noch offenen Lernstunden, Grün nur bei vollständig geplanter Woche.
- Desktop-Sidebar neu angeordnet, kein Text-Overlap, geringerer Abstand zum Hauptinhalt.
- Sidebar im Light Mode an das helle Design angepasst.
- Nachholen-Bereich klar als eigener Abschnitt mit Rahmen abgesetzt.
- Fortschritt-zum-Lernziel-Karte im Light Mode hell und kontrastreich gestaltet.
- Letzte Sessions: unterschiedliche Fach-Icons je nach Fachtyp; Farbe weiterhin aus „Fach bearbeiten“.
- Dark Mode weiterhin separat abgestimmt.


## v5.4.6
- Wochenansicht: Long-Press auf Mobilgeräten öffnet Bearbeiten/Löschen.
- Desktop: Rechtsklick auf einen Termin öffnet Bearbeiten/Löschen.
- Normaler Klick behält die bisherige Tagesnavigation.


## v5.4.8
- Die starre Tageskapazitäts-Prüfung beim manuellen Semesterplan wurde entfernt.
- Mehr als 5 Stunden pro Tag können jetzt manuell eingetragen und gespeichert werden.
- Die intelligente Auto-Verteilung darf weiterhin interne Kapazitäten als Planungshilfe verwenden; sie blockiert den manuellen Semesterplan nicht mehr.


## v5.4.9
- Semesterplan-Felder akzeptieren beliebige Dezimalwerte (`step="any"`).
- Keine Rundung mehr auf 0,25 Stunden / 15-Minuten-Schritte.
- Werte wie 3,83 / 4,1 / 5,55 werden akzeptiert und minutengenau gespeichert.

## v5.5.0
- Wochenansicht: Klick/Tap auf die tägliche Soll-Anzeige bearbeitet das Soll direkt, ohne in die Tagesansicht zu wechseln.
- Direkte Soll-Eingabe akzeptiert beliebige Dezimalwerte (Komma oder Punkt) und speichert minutengenau.
- Keyboard: Enter/Leertaste auf der Soll-Anzeige öffnet die Bearbeitung.

## v5.5.1
- Fixed the JavaScript syntax error in v5.5.0 that made the whole app non-interactive.
- Quick weekly Soll edit remains enabled by tapping/clicking the Soll summary.

## v5.5.2
- Changing Semesterbeginn/-ende now keeps existing Semesterplan values inside the range and auto-adds missing days from actual planned `study`/`makeup` blocks in `dailyPlan`.
- Extending the semester into a new month therefore updates `Verplant`, `Noch offen`, `Freie Tage`, and `Rest Ø` immediately when study blocks already exist there.
- Shrinking the range still excludes days outside the semester without deleting the underlying calendar appointments.

## v5.5.3
- Fixed Today card mismatch with "Heute geplant".
- Today detail now uses Semesterplan target or actual study blocks as fallback.
- Added green Lernziel progress bar to mobile dashboard.
