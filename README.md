# Taxatie-app — Houpels Valuation & Real Estate

Een Vite/React-taxatietool voor schattingsverslagen, met:
- **Supabase** voor gebruikersaccounts (login/registratie) en dossieropslag (database).
- Twee **serverless functies** (`/api/claude`, `/api/generate-pdf`) die op Vercel draaien.
- Eén klik op "Download PDF" die een echt PDF-bestand teruggeeft (via een headless Chromium-browser op de server).
- Installeerbaar als app (PWA) op Windows/Mac — zie "Als app installeren" verderop.

## Vastgoedtype: Residentieel / KMO-vastgoed / Bedrijfsvastgoed

Elk dossier begint op het tabblad **"Type"** met een keuze **"Vastgoedtype"**: *Residentieel*,
*KMO-vastgoed* of *Bedrijfsvastgoed* (bij Bedrijfsvastgoed volgt meteen ook een **subtype**:
Kantoor / Winkel / Industrieel-logistiek / Horeca). Dit is geen cosmetische instelling — vanaf
die keuze stelt de wizard andere vragen, gebruikt de rekenmodule een andere waarderingsmethode,
en ziet het rapport er anders uit. Dit hoofdstuk zet op een rij wat concreet verschilt, zodat
je niet per ongeluk residentiële velden verwacht bij een bedrijfsmatig dossier (of omgekeerd).

### 1. Een ander wizardtabblad: "Bedrijfskenmerken" i.p.v. "Ruimte-eigenschappen"

Bij *Residentieel* doorloop je het vertrouwde tabblad "Ruimte-eigenschappen" (kamers, tuin,
garage, keuken, slaapkamers, ...). Bij *KMO-vastgoed*/*Bedrijfsvastgoed* wordt dat tabblad
volledig vervangen door **"Bedrijfskenmerken"** (component `StepBedrijfskenmerken` in
`App.jsx`), met:

- **Algemene bedrijfskenmerken**: bestemmingszone (industriegebied, KMO-zone, gemengd
  regionaal bedrijventerrein, kleinhandelszone, ...), omgevingsvergunning milieu
  (klasse 1/2/3, niet vereist, in aanvraag), aantal parkeerplaatsen, aantal laadkades, en het
  EPC-regime — hier **kNR/NR** (klein niet-residentieel / niet-residentieel) in plaats van het
  residentiële EPC-certificaat in kWh/m².
- **Interne afwerking**: vloerafwerking (bv. industriële betonvloer, epoxycoating, verhoogde
  vloer, anti-slipvloer, ...), wandafwerking, plafondafwerking — het bedrijfsmatige antwoord op
  wat bij Residentieel via de kamers/ruimtes-lijst loopt.
- **Subtype-specifieke velden**, enkel zichtbaar bij *Bedrijfsvastgoed* met het bijhorende
  subtype gekozen:
  - *Kantoor*: indeling (landschaps-/cellen-/combikantoor, flexplekken), aantal verdiepingen,
    lift, serverruimte, certificering.
  - *Winkel*: locatiecategorie (kernwinkelgebied A-locatie t.e.m. randstedelijke ligging),
    gevelbreedte, etalage, pasanten, magazijn achteraan.
  - *Industrieel/logistiek*: vrije hoogte, vloerbelasting, aantal dock levellers.
  - *Horeca*: type horecazaak, vergunning uitbating, terras, keukenuitrusting, zitplaatsen.

### 2. Andere opties voor "Pand" en "Type huurcontract"

De Select "Pand" toont bij *Residentieel* de gewone woninglijst (rijwoning, villa,
appartement, ...); bij *KMO-vastgoed*/*Bedrijfsvastgoed* een eigen bedrijfsmatige lijst
(Bedrijfsgebouw, Bedrijfsloods/magazijn, KMO-unit, Kantoorgebouw, Winkelpand, Horecapand,
Gemengd kantoor/magazijn, **Bedrijfswoning (gecombineerd)**, Andere). "Bedrijfswoning" is
bewust de enige plek waar in de bedrijfsmatige flow nog over een "woning" gesproken wordt
(bv. een conciërgewoning bij een bedrijfsgebouw) — voor de rest is "woning"-taal er
opzettelijk uit gehaald. Hetzelfde patroon geldt voor "Type huurcontract": gewone woninghuur
bij Residentieel, versus Handelshuur (9 jaar, wet 30/04/1951), Handelshuur (korte duur/pop-up)
of kantoor-/bedrijfsruimtehuur (gemeen recht) bij KMO/Bedrijfsvastgoed. Wissel je het
Vastgoedtype over de grens residentieel/bedrijfsmatig heen, dan zet de app deze twee velden
automatisch terug op een zinvolle standaardwaarde voor de nieuwe categorie, zodat een dossier
nooit blijft steken met een optie uit de verkeerde lijst.

### 3. Huurder-sectie: extra Handelshuurwet-velden

Bij een verhuurd bedrijfsmatig pand vraagt de Huurder-sectie bijkomend naar zaken uit de
Handelshuurwet, zoals het **hernieuwingsrecht** (eerste/tweede/derde-laatste hernieuwing,
of nee/onbekend) naast de bestaande aanvangsdatum en eerste opzegmogelijkheid.

### 4. Waardering: ABEX-index versus manuele vervangingswaarde

Bij *Residentieel* blijft de rekenmodule (`berekenWaardering` in `src/domein/waardering.js`) de
bestaande ABEX-woningindex en vetusteitscoëfficiënten gebruiken (Klasse, Gevel, ABEX-index-
vandaag, veroudering, ...). Bij *KMO-vastgoed*/*Bedrijfsvastgoed* vul je op het tabblad
"Bedrijfskenmerken" in plaats daarvan een manuele **"Vervangingswaarde (bedrijfsmatig)"** in —
de nieuwbouwwaarde na veroudering, rechtstreeks geschat door de schatter-expert. Zodra dat veld
is ingevuld, negeert de rekenmodule de ABEX-index volledig en gebruikt ze die vervangingswaarde
als basis voor zowel de nieuwbouwwaarde als de actuele waarde van het gebouw (zichtbaar in het
rekenresultaat als `gebruiktBedrijfsVervangingswaarde: true`). Blijft het veld nog leeg, dan
valt de berekening voorlopig terug op de ABEX-index; staat het Vastgoedtype op Residentieel,
dan wordt een eventueel ingevulde bedrijfsvervangingswaarde altijd genegeerd. Zie
`src/__tests__/berekenWaardering.test.js` (blok "vervangingswaarde KMO-vastgoed/Bedrijfsvastgoed")
voor de exacte regels, inclusief oude dossiers zonder `vastgoedType`.

#### 4bis. De ABEX-prijstabel (`KLASSEN` in `src/constants.js`): bron, methode en periodieke update

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

#### 4ter. Typering van de klassen (Bescheiden / Gewoon / Verzorgd / Luxueus / Bungalow)

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

#### 4quater. Coëfficiënten per woongedeelte (`VERDIEPINGEN` in `src/constants.js`)

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

#### 4quinquies. Vetusteit (sleet): de 4 schuifregelaars op het tabblad "Waardering"

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

#### 4sexies. Levensduur van materialen (ter info, niet in de rekenmodule verwerkt)

De KAVEX-basistabellen geven ook een indicatieve levensduur van veelgebruikte bouwmaterialen/
-onderdelen (bv. dakbedekking, buitenschrijnwerk, technieken, sanitair, ...), en een reeks
vaste eenheidsprijzen "Diversen" voor elementen die niet via de Abex-m²-prijs lopen (casco
handelsruimte/kantoor, bijgebouwen/garages, veranda's, kelder, zolder als losse post). Dit zijn
zuivere naslag-gegevens voor de schatter — ze worden **niet** automatisch in `berekenWaardering`
verwerkt en zijn geen onderdeel van deze update; wie deze cijfers nodig heeft, raadpleegt de
KAVEX/FEBEVEX-basistabellen zelf.

### 5. Terminologie in labels, SWOT en rapport

Overal waar de bedrijfsmatige flow eigen tekst toont — veldlabels/hints, de automatisch
gegenereerde SWOT-tekst, en beide rapportopbouwpaden (`buildReportData` voor de PDF en de
`StepRapport`-preview) — is "woning"-taal vervangen door het bedrijfsmatige equivalent:
"Bewoonbare oppervlakte" wordt "Nuttige vloeroppervlakte", "Bewoonbaarheid" wordt
"Functionele geschiktheid", het EPC-certificaat voor woningen wordt het EPC-regime kNR/NR,
enzovoort. "Bedrijfswoning" (zie punt 2) blijft de enige bewuste uitzondering.

### 6. Reden van waardering: "Boekhoudkundige waardering"

De "Reden"-lijst heeft een extra optie **"Boekhoudkundige waardering"** (jaarrekening,
herwaardering van vaste activa) — beschikbaar bij elk Vastgoedtype, maar in de praktijk vooral
relevant bij KMO-vastgoed/Bedrijfsvastgoed.

### Waar dit in de code zit

De vertakking zelf gebeurt via hetzelfde patroon in elke stap-component en in beide
rapportopbouwpaden: `const isResidentieel = d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed";`
— bewust niet `=== "Residentieel"`, zodat een ouder dossier zonder `vastgoedType` gewoon als
residentieel blijft werken. De bedrijfsmatige optielijsten staan in `OPTS` (`vastgoedType`,
`bedrijfsSubtype`, `bedrijfsEpcType`, `pandTypeBedrijfsmatig`, `huurcontractTypeBedrijfsmatig`,
`kantoorIndeling`, `winkelLocatiecategorie`, `horecaType`, `huurderHernieuwingsrecht`, ...).

## Projectstructuur

```
taxatie-app/
├─ src/
│  ├─ App.jsx        ← de volledige app (wizard, dashboard, login, rapport)
│  ├─ main.jsx        ← mount-punt (ReactDOM.createRoot) + serviceworker-registratie
│  ├─ index.css        ← Tailwind + print-stijlen
│  └─ __tests__/       ← Vitest-tests (zie "npm test" hieronder)
├─ api/
│  ├─ claude.js        ← verbergt de Anthropic-sleutel, stuurt AI-aanvragen door
│  └─ generate-pdf.js  ← zet het rapport om naar een echt PDF-bestand
├─ supabase/
│  └─ schema.sql       ← database­structuur, uit te voeren in Supabase
├─ public/
│  ├─ manifest.json    ← PWA-manifest (naam, icoon, kleur) — zie "Als app installeren"
│  ├─ sw.js            ← minimale serviceworker, enkel nodig voor installeerbaarheid
│  └─ icons/, favicon.png, apple-touch-icon.png
├─ index.html, vite.config.js, tailwind.config.js, postcss.config.js
├─ vercel.json          ← verlengt de looptijd van de serverless functies
└─ .env.example         ← welke sleutels je moet invullen
```

## 1. Lokaal opzetten

```bash
npm install
cp .env.example .env
# vul .env in met je eigen sleutels (zie hieronder)
npm run dev
```

De app draait dan op `http://localhost:5173`. De AI- en PDF-knoppen werken lokaal ook,
via `npm run dev` **plus** `vercel dev` (zie stap 4) — met enkel `npm run dev` draaien de
`/api/*`-routes niet mee, want dat zijn Vercel-functies, geen Vite-routes.

Om ze wél lokaal te testen:
```bash
npm install -g vercel   # eenmalig
vercel dev
```

## 2. Omgevingsvariabelen

| Variabele | Waar nodig | Waarvoor |
|---|---|---|
| `VITE_SUPABASE_URL` | frontend + beide `/api`-functies | Supabase-projectadres |
| `VITE_SUPABASE_ANON_KEY` | frontend + beide `/api`-functies | publieke Supabase-sleutel (zie stap 3) |
| `VITE_GOOGLE_MAPS_API_KEY` | frontend | liggingskaart (Google Static Maps) — ontbreekt hij, dan blijft de kaart leeg, de rest van de app blijft werken |
| `ANTHROPIC_API_KEY` | enkel `/api/claude.js` | de eigenlijke AI-aanroepen (Claude); **nooit** met een `VITE_`-prefix, anders komt hij in de publieke browserbundel terecht |

De twee `VITE_SUPABASE_*`-variabelen staan hierboven bewust ook bij de `/api`-functies:
`api/claude.js` en `api/generate-pdf.js` gebruiken ze zelf ook, om het sessietoken van de
aanvrager te verifiëren bij Supabase (zie "Authenticatie" verderop) — niet enkel de frontend.

Lokaal vul je deze in `.env` in (zie `.env.example`); op Vercel onder
**Project Settings → Environment Variables** (zie stap 5).

## 3. Supabase opzetten (database + login + opslag)

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

## 4. Anthropic API-sleutel

1. Maak een sleutel aan op [console.anthropic.com](https://console.anthropic.com) → API keys.
2. Stel meteen een **uitgavenlimiet** in (Settings → Limits).

## 5. Hosten op Vercel

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

## Authenticatie tussen frontend en `/api`-functies

`/api/claude` en `/api/generate-pdf` vereisen allebei een geldig Supabase-sessietoken
(`Authorization: Bearer <token>`, automatisch meegestuurd door de frontend via
`haalSessieToken()` in `App.jsx`) — zonder geldig, ingelogd token weigeren beide functies de
aanvraag met status 401. Dat voorkomt dat iemand buiten de app om (bv. met `curl`) een
betaalde AI-aanroep of een zware PDF-render zou kunnen starten op kosten van dit project.

## Logboek (audit trail)

De tabel `dossier_events` (zie `schema.sql`, §5) houdt bij wie een dossier aanmaakte,
verwijderde, of als beheerder insprong in het dossier van een collega — raadpleegbaar
via **Table Editor → dossier_events** (enkel voor een account met rol `beheerder`, ook
via de gewone Supabase-client). Losse tekstwijzigingen binnenin een dossier worden niet
elk apart gelogd (dat zou, door de automatische tussentijdse opslag, een onwerkbaar
groot aantal regels opleveren) — enkel de drie gebeurtenissen hierboven.

## Als app installeren (PWA)

Deze webapp is installeerbaar als een "echte" app op zowel Windows als Mac, met een eigen
icoon en een eigen venster zonder browserbalk — zonder dat daar een aparte .dmg/.exe voor
nodig is. Werkt in Chrome en Edge (niet in Safari):

1. Open de gehoste app (bv. `https://taxatie.houpels.be`) in Chrome of Edge.
2. Klik op het installatie-icoontje rechts in de adresbalk (of: menu → "App installeren" /
   "Install app").
3. De app verschijnt voortaan als een gewoon programma, met een eigen icoon op het
   bureaublad/startmenu/Dock, los van de browser.

Dit blijft in essentie dezelfde webapp: internetverbinding blijft nodig (login, dossiers,
AI-analyse en PDF-generatie lopen allemaal via Supabase/Vercel), en elke update die je
publiceert is bij de volgende keer openen automatisch beschikbaar — er is geen aparte
installer om te herverspreiden bij een nieuwe versie. `public/manifest.json` bepaalt naam/
icoon/kleur; `public/sw.js` is de (minimale) serviceworker die enkel nodig is opdat de
browser de app als installeerbaar herkent — hij cachet bewust niets van `/api/*` of van
Supabase, enkel de vaste appschil (HTML/icoon), zodat er nooit een verouderd dossier of
databaseantwoord uit een cache zou kunnen komen.

## Bekende grenzen

- Vercel-serverless-functies accepteren maximaal **4,5 MB** aan aanvraaggegevens (een
  platformlimiet, los van elke code-instelling). Bij een dossier met veel/grote foto's
  wijkt de app hiervoor automatisch uit: foto's worden dan eerst tijdelijk naar de
  Supabase Storage-bucket opgeladen en enkel de link wordt meegestuurd naar
  `/api/generate-pdf` (zie `uploadFotoVoorPdf` in `App.jsx`); diezelfde omweg bestaat voor
  documentanalyse via `/api/claude` (zie `uploadDocVoorAnalyse`). Foto's worden bovendien al
  bij het opladen verkleind tot maximaal 1600px (zie `resizeImageBlob`) — een dossier met een
  ongewoon groot aantal foto's (40+) krijgt hierover een waarschuwing in de app, want twee
  volledige Chromium-renderbeurten per PDF-aanvraag blijven wel gevoelig voor de tijdslimiet.
- Er is geen enkel geautomatiseerd testbestand voor de rest van de app buiten de
  rekenmodule (`berekenWaardering`, zie `src/App.jsx`) — wijzigingen elders worden enkel
  manueel gecontroleerd.
- `App.jsx` bevat vandaag nog de volledige app in één bestand (~5.000+ regels: data,
  rekenmodule, alle wizardstappen, rapportopbouw, login). Werkt prima zolang je er alleen
  aan werkt; bij een volgende grote uitbreiding is dit een goed moment om de wizardstappen,
  de rekenmodule en de rapportopbouw elk naar een eigen bestand te verhuizen.

## Beveiligingsheaders en de Content-Security-Policy

`vercel.json` zet vijf headers die meteen actief zijn en geen risico dragen: `X-Frame-Options`
(verhindert dat de app in een vreemde pagina wordt ingebed — clickjacking op de knop
"Verwijderen" of op het aanmeldformulier), `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy` (enkel de camera blijft toegelaten, want de app gebruikt die voor foto's ter
plaatse) en `Strict-Transport-Security`.

De **Content-Security-Policy staat bewust in `Report-Only`**. Ze wordt dan wel gecontroleerd en
gerapporteerd in de console van de browser, maar blokkeert nog niets. De reden: zet de build ook
maar één script inline, dan zou een meteen afdwingende regel de hele app blank maken voor
iedereen — en dat valt vooraf niet met zekerheid te testen zonder een echte productiebuild.

Zo zet je ze scherp:

1. Open de app op `https://taxatie-app.vercel.app` en doorloop alle tabbladen, inclusief het
   opzoeken van een CaPaKey (kaart via `geo.api.vlaanderen.be`), de liggingskaart van Google, het
   opladen van een foto en een PDF-export.
2. Open de console van de browser (Chrome: rechtsklik → Inspecteren → tabblad Console) en kijk of
   er meldingen staan die met "Content Security Policy" beginnen.
3. Geen meldingen? Hernoem in `vercel.json` de sleutel `Content-Security-Policy-Report-Only` naar
   `Content-Security-Policy` en deploy opnieuw.
4. Wél meldingen? Die vermelden telkens welk adres geweigerd zou worden; voeg dat adres toe aan de
   juiste regel (`img-src` voor afbeeldingen, `connect-src` voor gegevens) en herhaal stap 1.

Let op: `vercel.json` is strikte JSON. Er kunnen geen commentaarregels in, en Vercel weigert een
deploy zodra er een eigen veld in staat dat niet in hun schema voorkomt — vandaar dat deze uitleg
hier staat en niet in het bestand zelf.
