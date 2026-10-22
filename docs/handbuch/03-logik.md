# 3 · Bedingte Logik und Berechnungen

Regeln lesen sich wie Sätze: **Wenn** [Feld] [ist / ist nicht / enthält / größer als / ist leer …] [Wert] **dann** [zeige oder verberge Feld oder Seite · mache Feld zur Pflicht · springe zu Seite · zeige Abschlussseite].

Beispiele:

- *Wenn „Sie sind“ ist „Unternehmen“, dann zeige Seite „Unternehmensdaten“.* Für Privatpersonen wird die Seite übersprungen.
- *Wenn „Streitwert“ größer als 10.000, dann mache „Begründung“ zur Pflicht.*
- *Wenn „Anliegen“ ist „Strafrecht“, dann zeige Abschlussseite „Eilfall“.*

Ein Feld oder eine Seite, die eine „zeige“-Regel hat, ist zunächst verborgen. „Verberge“ hat immer Vorrang. Antworten verborgener Felder werden beim Absenden verworfen – auch dann, wenn jemand sie technisch mitschickt.

## Fehler früh erkennen

Der Editor prüft laufend und markiert:

- Verweise auf gelöschte Felder, Seiten oder Abschlussseiten,
- Regeln, die nie zutreffen können (z. B. „größer als 10 **und** kleiner als 5“),
- Bedingungen auf Antworten, die das Feld gar nicht anbietet,
- zirkuläre Abhängigkeiten (A steuert B, B steuert A),
- widersprüchliche Regeln (gleiche Bedingung zeigt und verbirgt dasselbe),
- Sprünge rückwärts.

Fehler verhindern das Veröffentlichen; Hinweise nicht.

## Personalisierung

`{{schluessel}}` in Fragen, Beschreibungen und Abschlussseiten setzt die Antwort eines früheren Feldes ein, z. B. „Worum geht es, {{name}}?“.

## Berechnungen

Das Feld **Berechnung** rechnet mit einer Formel aus anderen Antworten: `{preis} * {anzahl}`, `sum({betrag})` über alle Einträge einer Wiederholgruppe, `round({a} / 3, 2)`, `if({alter} >= 18, "volljährig", "minderjährig")`, `days_between({von}, {bis})`, `years_since({geburtsdatum})`. Formeln werden mit einem eigenen Parser ausgewertet, nicht als Programmcode. Der Server rechnet beim Absenden selbst nach.

← [Formulare erstellen](02-formulare-erstellen.md) · weiter: [Darstellung](04-darstellung.md) →
