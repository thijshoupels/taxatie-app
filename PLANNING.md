# Planning — openstaande functionaliteiten

Backlog van functionele wensen die nog niet gebouwd zijn (los van de technische
opsplitsing van App.jsx in kleinere modules, zie de git-commitboodschappen
"App.jsx opsplitsen (stap N/N)" voor die voortgang).

Momenteel geen openstaande functionaliteiten — zie hieronder voor wat al is
afgewerkt.

## Afgewerkt

### 1. Afmetingen (appartementen) — "Gemeenschappelijke delen" als vuistregel-optie

Toggle toegevoegd naast het bestaande `gemeenschappelijkeDelenOpp`-veld in
`StepAfmetingen` (enkel bij `pandType === "Appartement"`): "12%-vuistregel
toepassen" zet het veld eenmalig op 12% van de reeds ingevulde ruimte-
oppervlaktes (tabel "Oppervlakte per bouweenheid" erboven, na coëfficiënten).
Nadien blijft het veld gewoon vrij overschrijfbaar — geen doorlopende
koppeling, puur een eenmalige vuistregel-invulling.

Nieuw veld: `gemeenschappelijkeDelenVuistregelActief` (boolean, per pand, in
`initialData`/`maakLeegPand`). Geen wijziging aan `berekenWaardering` nodig:
het bestaande `gemeenschappelijkeDelenOpp`-veld blijft de enige bron die de
rekenmodule en het rapport lezen.

### 2. Grond — optie "aandeel gemeenschap" (+12%)

Toggle toegevoegd bij "Grondwaarde per schijf" in `StepAfmetingen`: "Aandeel
gemeenschap toepassen" telt 12% bij de berekende grondwaarde (som van de
schijven) op. In tegenstelling tot punt 1 hierboven is dit een doorlopende
berekening (geen eenmalige invulling) — ze werkt overal door: intrinsieke
waarde, marktwaardebandbreedte, venale waarde.

Nieuw veld: `grondAandeelGemeenschapActief` (boolean, per pand). In
`berekenWaardering` (`src/domein/waardering.js`) is de grondwaarde opgesplitst
in `grondwaardeBasis` (som van de schijven, ongewijzigd) en het uiteindelijke
`grondwaarde` (basis + 12% wanneer actief) — `grondwaardeBasis` en het
toegepaste bedrag (`grondAandeelGemeenschapBedrag`) blijven ook apart
beschikbaar voor de UI.

### 3. DCF — optionele minwaarde voor transactiekosten

Nieuwe sectie "Transactiekosten bij DCF (optioneel)" in `StepWaardering`,
naar analogie van de bestaande optionele extra's (`energiecorrectieActief`,
`dcfMeerjarenActief`, `residueelActief`): een aan/uit-toggle
(`dcfTransactiekostenActief`) met een vrij in te vullen percentage
(`dcfTransactiekostenPct`) en een tip "Richtwaarde: 12%-14%
registratierechten, notariskosten, hypotheekkosten". Verrekend als minwaarde
op de gewone (directe-kapitalisatie) DCF-waarde — beïnvloedt de venale
waarde niet, enkel het DCF-cijfer en het rapportblok "Rendementsbenadering
(DCF)" (zowel scherm als PDF, via `rapportWaarderingsBlokken`).

Nieuwe berekende velden in `calc`: `dcfTransactiekostenBedrag`,
`dcfWaardeNaTransactiekosten`.
