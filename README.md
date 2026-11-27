# Taxatie-app — Houpels Valuation & Real Estate

Webapp voor schattingsverslagen (React/Vite), met **Supabase** voor accounts, dossiers en
bijlagen, en twee **Vercel-functies**: `/api/claude` (AI, de sleutel blijft op de server) en
`/api/generate-pdf` (het verslag als echte PDF via Chromium). Installeerbaar als app (PWA).

Vastgoedtypes: Residentieel, vijf bedrijfstypes (Kantoor, KMO-unit / gemengd, Industrie &
logistiek, Retail, Horeca), Garage / Staanplaats, Bouwgrond / grond en Landbouwgrond — zie
`src/domein/vastgoedtypes.js`. De gebruikershandleiding staat in `docs/handleiding.html` (en als
PDF in `public/`).

## Werkwijze

**Publiceren** — in Terminal, in de projectmap:

```bash
./publiceer.sh "Korte omschrijving van de aanpassing"
```

Het script haalt eerst de laatste versie van GitHub binnen, draait alle tests (`npm test`) en
bouwt de app (`npm run build`). Faalt één van beide, dan wordt er niets gepubliceerd. Daarna toont
het welke bestanden meegaan, vraagt om bevestiging, en doet `commit` + `push`; Vercel zet de
nieuwe versie dan automatisch online. Er gaat nooit een `.env`-bestand of dossierbackup mee.

**Automatische controle** — bij elke push draait GitHub dezelfde tests en build
(`.github/workflows/tests.yml`). Een rood kruisje bij de commit op GitHub = er is iets stuk.

**Databank** — wijzigingen aan de databank staan als SQL in `supabase/`. Een nieuwe databank
opbouwen: `schema.sql`, daarna `ai-verbruik.sql` en `optimalisatie-2026-11.sql` (in die volgorde,
zie het einde van `schema.sql`). Uitvoeren in Supabase → SQL Editor; elk bestand mag meerdere
keren uitgevoerd worden.

**Tests** — `npm test` (Vitest, `src/__tests__/`). De rekenmodule, de controles, het verslag,
de Vlabel-vergelijkingspunten en de opslag zijn gedekt; nieuwe functies krijgen een eigen test.

## Projectstructuur

```
src/
  App.jsx            aanmelden, dossieroverzicht ↔ wizard, opslaan
  schermen/          Dashboard, DossierWizard, Account, Kantoor-instellingen, Login
  stappen/           de tabbladen van de wizard (StepType, StepWaardering, …)
  rapport/           het verslag: bouwers.js + html.js (één HTML voor PDF én voorbeeld), StepRapport.jsx
  domein/            rekenregels zonder scherm: waardering, controles, kwaliteit, EPC, Vlabel, …
  data/              Supabase, AI, lokale opslag (offline), accounts, delen
  ui/                herbruikbare onderdelen (velden, handtekening, kwaliteitsbadge, …)
  lib/               opmaak van getallen, afbeeldingen, Excel-lezer
  __tests__/         Vitest
api/                 claude.js, generate-pdf.js (Vercel-functies)
supabase/            SQL (zie Werkwijze)
public/              manifest, serviceworker, iconen, handleiding-PDF
publiceer.sh         testen + publiceren in één commando
```

## Lokaal opzetten

```bash
npm install
cp .env.example .env      # vul de sleutels in (zie hieronder)
npm run dev               # http://localhost:5173
vercel dev                # nodig om ook /api/* (AI, PDF) lokaal te laten werken
```

| Variabele | Waar | Waarvoor |
|---|---|---|
| `VITE_SUPABASE_URL` | frontend + `/api` | Supabase-projectadres |
| `VITE_SUPABASE_ANON_KEY` | frontend + `/api` | publieke Supabase-sleutel (beveiliging zit in de toegangsregels) |
| `VITE_GOOGLE_MAPS_API_KEY` | frontend | liggingskaart — beperk de sleutel in Google Cloud tot het eigen domein |
| `ANTHROPIC_API_KEY` | enkel `/api/claude.js` | AI — **nooit** met `VITE_`-prefix |

Lokaal in `.env`, op Vercel onder Project Settings → Environment Variables.

### Supabase opzetten (database + login + opslag)

1. Maak een gratis project aan op [supabase.com](https://supabase.com).
2. **SQL Editor** → nieuwe query → plak de volledige inhoud van `supabase/schema.sql` → **Run**.
   Dit bestand is idempotent: je kan het probleemloos opnieuw volledig plakken en uitvoeren
   na een latere aanpassing (dat is ook hoe toekomstige schema-wijzigingen toegepast worden).
   Het maakt meteen ook de opslag-bucket (`dossier-bijlagen`, privé) mét toegangsregels aan —
   daar is geen aparte stap in de Dashboard voor nodig.
3. **Project Settings → API** → noteer de **Project URL** en de **anon public key**.
   (De anon key is bewust publiek zichtbaar in de browser — dat is normaal bij Supabase;
   de echte beveiliging gebeurt via de rijregels (RLS) in `schema.sql`, niet via het
   geheim houden van deze sleutel.)
4. **Authentication → Providers** → controleer of "Confirm email" aan of uit staat naar wens
   (staat het aan, dan moet een nieuwe makelaar eerst een bevestigingsmail volgen vóór het
   eerste keer aanmelden — de app vangt dat geval netjes op).
5. **Medewerkers toevoegen** kan op twee manieren: ze registreren zichzelf via het tabblad
   "Nieuwe makelaar" in de app, of jij voegt ze toe via **Authentication → Users → Add user**.
6. **Iemand beheerder maken**: **Table Editor → profielen** → zoek de rij van die persoon
   (op naam/e-mail) → zet de kolom `rol` op `beheerder`. Een beheerder ziet en bewerkt de
   dossiers van alle collega's (bv. om in te springen bij afwezigheid), en kan het logboek
   (`dossier_events`, zie verderop) raadplegen. Dit kan enkel via de Dashboard, bewust niet
   via de app zelf — zie ook de kolomrechten in `schema.sql` (§3).
7. **Back-ups**: controleer zelf even **Settings → Database → Backups** — op de gratis/pro-tier
   is point-in-time-recovery niet altijd standaard aan, en dossiers kunnen jarenlang juridisch
   relevant blijven.

### Anthropic API-sleutel

1. Maak een sleutel aan op [console.anthropic.com](https://console.anthropic.com) → API keys.
2. Stel meteen een **uitgavenlimiet** in (Settings → Limits).

### Hosten op Vercel

1. Push dit project naar een Git-repository (GitHub/GitLab/Bitbucket) — commit ook
   `package-lock.json` mee (die staat mee in de repo): Vercel gebruikt die automatisch om
   met `npm ci` exact dezelfde afhankelijkheden te installeren als lokaal getest, in plaats
   van een `npm install` die stilletjes een andere (nieuwere) patch-versie zou kunnen ophalen.
2. Ga naar [vercel.com](https://vercel.com) → **New Project** → importeer de repository.
   Vercel herkent dit automatisch als een Vite-project; de map `/api` wordt automatisch
   als serverless functies gehost.
3. Zet in **Project Settings → Environment Variables** de vier sleutels uit stap 2 hierboven.
4. **Deploy.** `vercel.json` verlengt de looptijd van de twee functies al (60s voor de PDF,
   90s voor Claude) — het opstarten van de onzichtbare browser voor de PDF kost enkele seconden.
5. Optioneel: **Domains** om een eigen domein te koppelen (bv. `taxatie.houpels.be`).

### Authenticatie tussen frontend en `/api`-functies

`/api/claude` en `/api/generate-pdf` vereisen allebei een geldig Supabase-sessietoken
(`Authorization: Bearer <token>`, automatisch meegestuurd door de frontend via
`haalSessieToken()` in `App.jsx`) — zonder geldig, ingelogd token weigeren beide functies de
aanvraag met status 401. Dat voorkomt dat iemand buiten de app om (bv. met `curl`) een
betaalde AI-aanroep of een zware PDF-render zou kunnen starten op kosten van dit project.

### Logboek (audit trail)

De tabel `dossier_events` (zie `schema.sql`, §5) houdt bij wie een dossier aanmaakte,
verwijderde, of als beheerder insprong in het dossier van een collega — raadpleegbaar
via **Table Editor → dossier_events** (enkel voor een account met rol `beheerder`, ook
via de gewone Supabase-client). Losse tekstwijzigingen binnenin een dossier worden niet
elk apart gelogd (dat zou, door de automatische tussentijdse opslag, een onwerkbaar
groot aantal regels opleveren) — enkel de drie gebeurtenissen hierboven.

### Als app installeren (PWA)

Deze webapp is installeerbaar als een "echte" app op zowel Windows als Mac, met een eigen
icoon en een eigen venster zonder browserbalk — zonder dat daar een aparte .dmg/.exe voor
nodig is. Werkt in Chrome en Edge (niet in Safari):

1. Open de gehoste app (bv. `https://taxatie.houpels.be`) in Chrome of Edge.
2. Klik op het installatie-icoontje rechts in de adresbalk (of: menu → "App installeren" /
   "Install app").
3. De app verschijnt voortaan als een gewoon programma, met een eigen icoon op het
   bureaublad/startmenu/Dock, los van de browser.

Dit blijft in essentie dezelfde webapp: internetverbinding blijft nodig (login, dossiers,

## Achtergrond bij de rekenmodule

### De ABEX-prijstabel (`KLASSEN` in `src/constants.js`): bron, methode en periodieke update

De referentieprijzen per m² BVO (`KLASSEN[...].basis1998`, gebruikt in de Abex-tabel op het
tabblad "Waardering") komen niet uit het niets: ze zijn herleid uit de officiële **KAVEX/FEBEVEX
"Basistabellen"** (Belgische/Vlaamse kostprijstabellen bouwsector, opgesteld door erkende
landmeters-experten en periodiek herzien), gekoppeld aan een specifieke ABEX-indexstand op het
moment van publicatie. Laatste herijking: juli 2022, basis 954 (d.w.z. de KAVEX-tabel van die
editie is gekoppeld aan een ABEX-index van 954). Omdat de rekenmodule zelf werkt met een
1998-basiswaarde (`ABEX_INDEX_1998 = 475`, historisch de ABEX-index van 1998, het ijkpunt
waartegen de app alle klasseprijzen intern bijhoudt), wordt elke nieuwe KAVEX-tabel omgerekend
met:

```
basis1998_nieuw = prijs_gesloten_bij_KAVEX-index / KAVEX-index × 475
```

— dus telkens uitgaande van de **gesloten bouwvorm** (2-gevel) uit de bron-tabel, wat exact
overeenkomt met wat `basis1998` in de code voorstelt. Halfopen (3-gevel) en open (4-gevel)
worden in de app niet apart per klasse bijgehouden, maar afgeleid met een vaste multiplicator
(`GEVEL_FACTOR = { 2: 1, 3: 1.1, 4: 1.15 }`). Dat is een bewuste vereenvoudiging: in de KAVEX-
brontabel zelf ligt de halfopen/gesloten- en open/gesloten-verhouding niet bij elke klasse exact
op 1,10 en 1,15 (ze schommelt typisch tussen pakweg 1,05–1,07 resp. 1,09–1,14 naargelang de
klasse). Voor gesloten bebouwing zijn de cijfers dus exact herleid uit de bron; voor halfopen/
open blijft het een goede, maar geen perfecte benadering.

**Bij een volgende ABEX/KAVEX-herziening** (KAVEX-basistabellen verschijnen onregelmatig, de
ABEX-index zelf wordt in principe tweemaal per jaar herzien — zie hieronder): neem de nieuwe
KAVEX-basistabel, herbereken elke klasse met dezelfde formule (gesloten-prijs × 475 ÷ nieuwe-
KAVEX-indexstand) en werk de betrokken `basis1998`-waarden in `KLASSEN` bij. De comment-blokken
bovenaan `KLASSEN` en `VERDIEPINGEN` in `src/constants.js` lichten dit stap voor stap toe en
houden ook de datum/bron van de laatste herijking bij.

**De actuele ABEX-index** (`d.abexIndexHuidig`, in te vullen door de schatter op het tabblad
"Waardering") is een apart, onafhankelijk in te vullen gegeven — dat is niet de KAVEX-
koppelindex hierboven, maar de index die vandaag geldt. Deze wordt tweemaal per jaar
gepubliceerd door de ABEX (Belgische Associatie van Experten) op `https://abex.be`; controleer
bij twijfel altijd de meest recente stand daar, aangezien dit document niet automatisch
meegroeit met nieuwe publicaties.

### Typering van de klassen (Bescheiden / Gewoon / Verzorgd / Luxueus / Bungalow)

De KAVEX-basistabellen omschrijven elke prijsklasse aan de hand van een concreet bouwprofiel;
dit is de vuistregel die de schatter kan gebruiken om een pand aan de juiste `klasse` in de
Abex-tabel te koppelen (zie ook de kolom "Type" — Woningen versus Appartementen hebben elk hun
eigen klasse-set):

- **Bescheiden woning**: eenvoudige, functionele afwerking, beperkt comfort, standaard
  materialen.
- **Gewoon huis / basiswoning**: de meest voorkomende doorsnee-eengezinswoning, normale
  hedendaagse afwerking zonder bijzondere luxe.
- **Verzorgde / comfortwoning**: kwalitatief hoogwaardigere afwerking en technieken dan
  "gewoon", zonder uitgesproken luxe-uitstraling.
- **Luxueuze woning / herenhuis / luxueuze villa**: hoogwaardige, dure afwerkingsmaterialen,
  ruime en representatieve indeling. Vuistregel uit de bron: een woning met een **E-peil onder
  E40** (bijna-energieneutraal/passief) wordt daardoor op zich al vaak als "luxueus" gecatalo-
  geerd, ook als de afwerking op zich sober oogt — de investering in de schil/techniek weegt
  even zwaar door.
- **Bungalow (comfortabel)**: vrijstaande gelijkvloerse woning; de KAVEX-tabel biedt deze klasse
  bewust enkel aan in halfopen/open bouwvorm (geen gesloten-notering), vandaar dat deze klasse
  in de Abex-tabel van de app geen gesloten-kolom toont.
- **Appartementsgebouw** (Gewoon/Verzorgd/Luxueus): dezelfde kwaliteitslogica als hierboven,
  maar dan per wooneenheid in een meergezinsgebouw — vandaar de aparte `type: "Appartementen"`-
  reeks in `KLASSEN`.

### Coëfficiënten per woongedeelte (`VERDIEPINGEN` in `src/constants.js`)

De Abex-prijs per m² BVO geldt voor de hoofdverdieping van een gelijkvloerse woning; andere
ruimtes tellen slechts gedeeltelijk mee, omdat ze doorgaans goedkoper zijn per m² (minder
afwerking, lagere plafonds, geen volwaardige technieken, ...). De KAVEX-basistabellen geven
hiervoor een referentietabel "Coëfficiënten per woongedeelte", waartegen de coëfficiënten in
`VERDIEPINGEN` bij deze update zijn afgetoetst:

- **Gelijkvloers / eerste verdieping**: 1,0 (volle waarde, ongewijzigd).
- **Kelder** (normaal bruikbare, niet-bewoonbare kelder): 0,4 — bijgesteld vanaf 0,5, conform de
  KAVEX-richtwaarde voor niet-bewoonbare kelders.
- **Tweede verdieping**: 0,9 (vaste KAVEX-waarde voor hogere verdiepingen) — bijgesteld vanaf
  0,7, wat eerder aansloot bij een derde (0,8) of vierde verdieping (0,7) in de bron-tabel.
- **Zolder**: 0,6 (ongewijzigd — dit valt binnen de KAVEX-bandbreedte voor een (deels)
  bewoonbare zolderverdieping).
- **Garage**: 0,5 (ongewijzigd — sluit aan bij de KAVEX-richtwaarde voor een inpandige garage).
- **Tuinberging**: 0,3 — bijgesteld vanaf 0,6, om beter aan te sluiten bij de KAVEX-bandbreedte
  voor niet-bewoonbare bijgebouwen (pomphuis, bergplaats, serre e.d.: 0,1-0,4); een tuinberging
  is geen volwaardig bewoonbaar bijgebouw en hoorde dus niet bij het hogere "garage"-niveau.
- **Berging (inpandig), terras, tuin**: ongewijzigd — dit zijn benaderende, niet één-op-één in
  de KAVEX-tabel terug te vinden coëfficiënten en blijven daarom binnen de eerder gehanteerde,
  ruimere marge.

Deze coëfficiënten zijn en blijven **manueel bijstelbaar per dossier** (het zijn richtwaarden,
geen harde regel) — de tabel hierboven is enkel de KAVEX-onderbouwing van de standaardwaarden
waarmee een nieuw dossier start.

### Vetusteit (sleet): de 4 schuifregelaars op het tabblad "Waardering"

De vier vetusteitsvelden (Ouderdom, Frequentie van onderhoud, Gebruik, Kwaliteit van onderhoud)
zijn een vrije, door de schatter zelf in te schatten percentage — de app rekent ze louter samen
(som of gemiddelde, afhankelijk van `d.vetusteitMethode`) tot een totale afschrijving. De KAVEX-
basistabellen bevatten een "Praktische regel voor het berekenen van de sleet" die als houvast
kan dienen bij die inschatting (zichtbaar als hint-tekst onder elke schuifregelaar sinds deze
update):

- **Ouderdom**: circa 1% afschrijving per jaar ouderdom, met een gebruikelijke bovengrens
  rond 60-70% voor een sterk verouderd pand.
- **Frequentie van onderhoud**: Regelmatig 0% · Normaal 5% · Onregelmatig 15% · Verwaarloosd
  30%.
- **Gebruik**: Weinig 0% · Normaal 5% · Druk 5-8% · Intensief 8%.
- **Kwaliteit van onderhoud**: Perfect 0% · Normaal 5% · Middelmatig 15% · Nihil 30%.

Dit blijft bewust een manuele inschatting door de schatter-expert, niet een automatische
berekening — de hints zijn puur ter referentie.

### Levensduur van materialen (ter info, niet in de rekenmodule verwerkt)

De KAVEX-basistabellen geven ook een indicatieve levensduur van veelgebruikte bouwmaterialen/
-onderdelen (bv. dakbedekking, buitenschrijnwerk, technieken, sanitair, ...), en een reeks
vaste eenheidsprijzen "Diversen" voor elementen die niet via de Abex-m²-prijs lopen (casco
handelsruimte/kantoor, bijgebouwen/garages, veranda's, kelder, zolder als losse post). Dit zijn
zuivere naslag-gegevens voor de schatter — ze worden **niet** automatisch in `berekenWaardering`
verwerkt en zijn geen onderdeel van deze update; wie deze cijfers nodig heeft, raadpleegt de
KAVEX/FEBEVEX-basistabellen zelf.


## Bekende grenzen

- Vercel-functies aanvaarden max. 4,5 MB per aanvraag. Bij veel of grote foto's laadt de app ze
  eerst tijdelijk op naar Supabase Storage en stuurt enkel de link mee (PDF en AI-documenten).
- Foto's staan in Supabase Storage (`<dossier-id>/fotos/`), in de databank staat enkel het pad (zie
  `src/data/fotoOpslag.js`). Oudere dossiers met foto's als base64 in de databank blijven werken; hun
  foto's verhuizen bij de eerstvolgende opslag.
- De Content-Security-Policy in `vercel.json` wordt afgedwongen. Komt er een nieuwe externe dienst
  bij (kaart, lettertype, API), voeg het adres dan toe aan de juiste regel (`img-src`,
  `connect-src`, …), anders blokkeert de browser het.
