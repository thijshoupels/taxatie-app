# Planning — openstaande functionaliteiten

Backlog van functionele wensen die nog niet gebouwd zijn (los van de technische
opsplitsing van App.jsx in kleinere modules, zie de git-commitboodschappen
"App.jsx opsplitsen (stap N/N)" voor die voortgang).

## 1. Afmetingen (appartementen) — "Gemeenschappelijke delen" als vuistregel-optie

Bij de afmetingen van een appartement een optie toevoegen (in een dropdown) om
"Gemeenschappelijke delen" te selecteren, waarbij de oppervlakte automatisch op
12% van de daarboven al ingevulde oppervlakten wordt gezet — dit als vuistregel,
i.p.v. dat de gebruiker dat percentage/de m² zelf moet uitrekenen en intypen.

Er bestaat vandaag al een manueel veld hiervoor (`gemeenschappelijkeDelenOpp` in
`initialData`/`StepAfmetingen`), maar zonder de automatische 12%-vuistregel.

Nog te beslissen vóór implementatie: waar precies de "dropdown" komt — een
nieuwe optie in de bestaande verdieping-dropdown per ruimte-rij (naast
gelijkvloers/1e verdiep/zolder/...), of een apart knopje/toggle naast het
bestaande `gemeenschappelijkeDelenOpp`-veld dat de 12%-vuistregel toepast (en
nadien nog overschrijfbaar blijft).

Raakt vermoedelijk: `StepAfmetingen` (UI) + `berekenWaardering` in
`src/domein/waardering.js` (rekenlogica).

## 2. Grond — optie "aandeel gemeenschap" (+12%)

Ook bij de grondwaarde een optie toevoegen om er 12% bij te tellen, onder de
noemer "aandeel gemeenschap" — dezelfde vuistregel-gedachte als bij punt 1,
maar dan toegepast op de grond/schijven-berekening in plaats van op de
gebouwoppervlakte.

Nog te beslissen vóór implementatie: exacte plaats in de UI (bij de
schijven-tabel in `StepAfmetingen`?) en of dit een apart veld wordt of een
toggle op de bestaande grondwaarde-berekening.

Raakt vermoedelijk: `StepAfmetingen` (UI) + `berekenWaardering` in
`src/domein/waardering.js` (grondwaarde-berekening).

## 3. DCF — optionele minwaarde voor transactiekosten

Bij de gewone DCF-waardering een optionele (aan/uit) minwaarde toevoegen om
transactiekosten te verrekenen — zelf in te vullen door de schatter-expert
(vrij percentage of bedrag), naar analogie van de bestaande optionele extra's
(`energiecorrectieActief`, `dcfMeerjarenActief`, `residueelActief` in
`src/domein/waardering.js`/`StepWaardering`).

Toon bij het invoerveld een tip: "12%-14% registratierechten, notariskosten,
hypotheekkosten" — louter als richtwaarde, de schatter-expert vult zelf het
percentage/bedrag in (net zoals bij de andere optionele extra's blijft dit
manueel instelbaar, geen automatisch toegepaste correctie).

Raakt: `StepWaardering` (UI) + `berekenWaardering` in `src/domein/waardering.js`.
