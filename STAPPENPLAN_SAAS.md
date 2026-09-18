# Taxatie-app als dienst voor andere kantoren — stappenplan

*Opgesteld op basis van je keuzes: gedeelde SaaS-omgeving met een kantoor-beheerder per klant, een
groeipad naar white-label voor grote klanten, en eigen huisstijl per kantoor. Doelgroep (individuele
schatters én grotere kantoren) hou je bewust open.*

## 1. Waar je nu staat

De app is vandaag gebouwd voor **één bedrijf met twee huisstijlen**, niet voor meerdere onafhankelijke
klanten. Concreet, na nazicht van de huidige code:

- **`profielen`**-tabel: elke gebruiker heeft een rol, `makelaar` of `beheerder`. Een `beheerder` kan
  via `is_beheerder()` (een SQL-functie) **elk dossier in de hele database** zien, bewerken en
  verwijderen — niet enkel die van zijn eigen kantoor, want er bestaat momenteel geen "kantoor" in de
  database.
- **`dossiers`**-tabel: heeft enkel een `owner_id` (de makelaar). Geen kolom die aangeeft bij welk
  kantoor een dossier hoort.
- **Huisstijl (Houpels vs. Huyzen Vastgoed)**: dit is geen echte instelling, maar een **hardcoded
  check op het e-mailadres** (`kiesHuisstijl`: eindigt het mailadres op `@huyzen.be`, dan Huyzen,
  anders Houpels). Er zijn maar twee mogelijke huisstijlen, in de code zelf vastgelegd.
- **Bijlagen (foto's/documenten)** in Supabase Storage volgen dezelfde toegangslogica als de
  dossiers zelf (via het gekoppelde dossier), dus die schaalt automatisch mee zodra de dossier-regels
  kloppen.

**Belangrijk om helder te hebben:** dit is op dit moment **geen multi-tenant systeem** — het is één
gedeelde pot gebruikers en dossiers, met een handig maar bedrijfsintern onderscheid (Houpels/Huyzen)
er bovenop geplakt. Zodra je hier een **écht ander, onafhankelijk kantoor** bij zet, kan élke
"beheerder" van dat andere kantoor in theorie alle dossiers van jouw kantoor zien (en omgekeerd) — dat
is een datalek in wording, geen kleinigheid. Dit moet dus **als allereerste** worden opgelost, nog
vóór er één betalende klant bijkomt.

De goede kant: het onderscheid "beheerder ziet alles, makelaar ziet enkel eigen dossiers" *bestaat al*
als concept, inclusief een audit-log (`dossier_events`) van wanneer een beheerder in andermans dossier
inspringt. Dat is precies het bouwblok dat je vroeg ("een beheerder per kantoor die alle taxaties van
zijn kantoor kan zien") — het moet enkel **kantoor-breed** gemaakt worden in plaats van
**systeembreed**.

## 2. Doelarchitectuur

### 2.1 Eén nieuw begrip: het kantoor

Een nieuwe tabel `kantoren` wordt de spil van alles:

| veld | betekenis |
|---|---|
| `id` | uniek kantoor-ID |
| `naam` | bedrijfsnaam, komt in het rapport |
| `kleur`, `logo` | huisstijl — vervangt de hardcoded `HUISSTIJLEN` |
| `adres`, `contactgegevens` | voor kop-/voettekst en eedformule |
| `tarieven` | optioneel: eigen prijstabel per kantoor (i.p.v. de huidige HV&RE-tarieven) |
| `abonnement_status`, `plan` | actief/geblokkeerd, welk pakket |
| `slug` of eigen domeinnaam | voor een herkenbare login-URL per kantoor (optioneel, latere fase) |

`profielen` krijgt een verplichte `kantoor_id`, en de rol wordt **per kantoor** bekeken: een
`kantoor-beheerder` ziet en beheert alle dossiers van zíjn kantoor, een `schatter` enkel de eigen. Voor
jezelf blijft er nog een derde, hoger niveau nodig: een `platform-beheerder` (enkel jij), die
kantoren aanmaakt/blokkeert en bij ernstige supportvragen kan meekijken — een apart mechanisme, niet
zomaar "beheerder" herbenoemd, anders creëer je opnieuw een systeembrede achterdeur.

`dossiers` krijgt een verplichte `kantoor_id` (rechtstreeks erop, niet enkel afgeleid via de eigenaar
— dat maakt de toegangsregels simpel en snel). Alle bestaande dossiers krijgen bij de migratie het
kantoor-ID van HV&RE/Huyzen (die blijven gewoon één kantoor, of desgewenst twee — jouw keuze).

### 2.2 Toegangsregels (RLS) herzien

`is_beheerder()` wordt vervangen door een kantoor-bewuste versie: een gebruiker ziet een dossier als
hij de eigenaar is, **of** als hij kantoor-beheerder is **van hetzelfde kantoor** als het dossier. Dit
is een kleine, mechanische aanpassing van de bestaande policies (`eigen dossiers of beheerder ziet
alles`, enz.) — het patroon blijft identiek, enkel de voorwaarde wordt scherper. Hetzelfde voor het
logboek (`dossier_events`): een kantoor-beheerder leest voortaan enkel het logboek van zijn eigen
kantoor.

### 2.3 Huisstijl wordt een instelling, geen code

De huidige `HUISSTIJLEN`-lijst en `kiesHuisstijl(email)` in de code verdwijnen. In de plaats komt een
eenvoudig **instellingenscherm voor de kantoor-beheerder**: naam, kleur, logo uploaden, adres,
contactgegevens, eventueel eigen tarieven. Deze gegevens komen uit de `kantoren`-tabel op basis van
`profielen.kantoor_id` — geen hardcoded e-maildomein-check meer. Dit is meteen ook de plek waar je
zelf, als eerste "klant", je eigen twee bestaande huisstijlen (Houpels, Huyzen) in onderbrengt zodra
de migratie draait.

### 2.4 Pad naar white-label, zonder er nu al voor te bouwen

Omdat `kantoor_id` overal een eerste-klas begrip wordt (in de database, in de RLS, in Storage-paden),
kan een groot kantoor later relatief eenvoudig "uitgekoppeld" worden naar een eigen Supabase-project +
eigen Vercel-domein: één druk-op-de-knop-export van alle rijen met dat `kantoor_id`, geïmporteerd in
een verse database. Dat is geen herbouw, enkel een migratiescript — precies omdat de scheiding er van
bij het begin al is. Je hoeft dit dus **niet nu al** te bouwen; je moet enkel vermijden dat je nu iets
bouwt dat die scheiding ondermijnt (bv. gedeelde referentiedata tussen kantoren die niet per kantoor
overschrijfbaar is).

### 2.5 Eigen productidentiteit

Zodra dit een dienst voor andere kantoren wordt, kan de app niet langer "Houpels Valuation & Real
Estate" heten voor iedereen — dat is jouw eigen taxatiebureau, niet het softwareproduct. Denk na over
een neutrale productnaam en een eigen, kleine marketingpagina (los van
schatterexpert-waasland.be, dat je eigen bureau blijft promoten). Dit hoeft geen aparte
vennootschap te zijn om mee te starten, maar bespreek met je boekhouder of het op termijn (BTW,
aansprakelijkheid, facturatie aan andere ondernemingen) beter apart ondergebracht wordt — dat is een
boekhoudkundig/juridisch advies dat ik je niet kan geven.

## 3. Juridische en praktische aandachtspunten

- **AVG/GDPR — verwerkersovereenkomst**: zodra je persoonsgegevens van de *klanten van andere
  kantoren* opslaat (adressen, eigenaarsnamen in taxatiedossiers), word je voor die kantoren
  "verwerker". Elk kantoor heeft dan een verwerkersovereenkomst met jou nodig. Laat dit door een
  jurist opstellen — ik kan de tekst niet als juridisch bindend advies opstellen, wel een eerste
  ontwerp voorbereiden als vertrekpunt voor die jurist.
- **Algemene voorwaarden / SaaS-overeenkomst** per klant-kantoor (opzegtermijn, uptime, wat er met
  hun data gebeurt bij opzeg — belangrijk gezien de wettelijke bewaarplicht van taxatieverslagen).
  Zelfde caveat: laat dit juridisch nakijken.
- **Vlabel-erkenning blijft persoonlijk**: elke schatter in elk kantoor houdt zijn eigen BIV-/
  Vlabel-nummer (dat staat vandaag al correct op het profiel-niveau, niet op kantoor-niveau — dat
  blijft zo).
- **Concurrentie-overweging**: "andere spelers" kan ook rechtstreekse concurrenten in het Waasland
  omvatten. Dat is uiteindelijk jouw commerciële keuze, maar het is de moeite waard om vooraf te
  bepalen of je landelijk positioneert (dienst voor schatters overal in Vlaanderen) dan wel gericht
  op je eigen regio — dat verandert wie je als eerste klanten aanspreekt.

## 4. Stappenplan — gefaseerd

**Fase 0 — Fundament (voor er één regel multi-tenant code geschreven wordt)**
Bepaal kort: productnaam, of je zelf (HV&RE) klant "nul" wordt in het nieuwe model, en met wie je de
verwerkersovereenkomst/voorwaarden laat opstellen. Dit kan parallel met Fase 1 lopen.

**Fase 1 — Multi-tenancy in de database (technisch, kritiek, eerst)**
- `kantoren`-tabel aanmaken.
- `kantoor_id` toevoegen aan `profielen` en `dossiers`, bestaande data migreren naar één (of twee)
  kantoren voor HV&RE/Huyzen.
- `is_beheerder()` en alle RLS-policies herzien naar kantoor-scope.
- Grondig testen: een tweede, volledig fictief testkantoor aanmaken en expliciet verifiëren dat een
  beheerder van dat testkantoor **niets** van HV&RE/Huyzen kan zien, en omgekeerd.

**Fase 2 — Huisstijl als instelling**
- Instellingenscherm voor kantoor-beheerder (naam, kleur, logo, adres, contactgegevens, tarieven).
- `kiesHuisstijl`/`HUISSTIJLEN` vervangen door een opzoeking via `kantoor_id`.
- Rapport-opbouw (`bouwers.js`) en de PDF-generatie (`api/generate-pdf.js`) aanpassen zodat ze de
  kantoor-huisstijl gebruiken in plaats van de huidige twee hardcoded stijlen.

**Fase 3 — Onboarding (eerst handmatig, bewust simpel)**
Voor de eerste klanten (denk 2 à 5) is een self-service aanmeldflow overbodige complexiteit. Jij maakt
het kantoor + eerste beheerder-account zelf aan (via een klein intern scherm of rechtstreeks in
Supabase). Dat geeft je meteen ook direct contact met elke pilootklant — waardevol voor feedback.

**Fase 4 — Eerste piloten**
Werf 2–3 kantoren uit je eigen netwerk (individuele schatters én/of een kantoor met meerdere
medewerkers, zoals je aangaf — de kantoor-structuur ondersteunt beide vormen even goed: een
"kantoor" met één gebruiker is gewoon een solo-schatter). Gratis of sterk verlaagd tarief in ruil voor
actieve feedback gedurende 1–2 maanden.

**Fase 5 — Facturatie**
Start manueel (zelf een factuur opmaken per kantoor). Automatiseer pas met Stripe- of
Mollie-abonnementen zodra het aantal klanten dat rechtvaardigt — vroegtijdig automatiseren kost nu
meer tijd dan het bespaart.

**Fase 6 — Zelfbediening en marketing**
Pas wanneer er aantoonbare vraag is (bv. via mond-tot-mondreclame na de piloten): een eigen
marketingpagina voor het product, een self-service aanmeldflow, geautomatiseerde facturatie.

**Fase 7 — White-label (optioneel, enkel bij een grote klant die het nodig heeft)**
Dankzij de aanpak in Fase 1 is dit een exportscript + nieuwe deploy, geen herbouw — pas hieraan
beginnen wanneer een concrete klant erom vraagt.

## 5. Voorstel voor de eerstvolgende stap

Fase 1 (multi-tenancy in de database) is de enige stap die **niet uitstelbaar** is zodra je ook maar
overweegt een tweede, onafhankelijk kantoor toe te laten — alles daarna bouwt erop verder. Ik stel
voor dat we hiermee beginnen: het schema-ontwerp voor `kantoren` + de aangepaste RLS-policies
uitschrijven, lokaal verifiëren met een fictief testkantoor, en pas dan overgaan naar de
huisstijl-instellingen (Fase 2).

Zeg gerust of je liever eerst de juridische/commerciële kant (verwerkersovereenkomst, voorwaarden,
prijszetting) verder uitwerkt, of meteen met de technische Fase 1 start.
