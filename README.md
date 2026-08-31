# Taxatie-app — Houpels Valuation & Real Estate

Een Vite/React-taxatietool voor schattingsverslagen, met:
- **Supabase** voor gebruikersaccounts (login/registratie) en dossieropslag (database).
- Twee **serverless functies** (`/api/claude`, `/api/generate-pdf`) die op Vercel draaien.
- Eén klik op "Download PDF" die een echt PDF-bestand teruggeeft (via een headless Chromium-browser op de server).
- Installeerbaar als app (PWA) op Windows/Mac — zie "Als app installeren" verderop.

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
