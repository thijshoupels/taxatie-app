# Taxatie-app — Houpels Valuation & Real Estate

Een Vite/React-taxatietool voor schattingsverslagen, met:
- **Supabase** voor gebruikersaccounts (login/registratie) en dossieropslag (database).
- Twee **serverless functies** (`/api/claude`, `/api/generate-pdf`) die op Vercel draaien.
- Eén klik op "Download PDF" die een echt PDF-bestand teruggeeft (via een headless Chromium-browser op de server).

## Projectstructuur

```
taxatie-app/
├─ src/
│  ├─ App.jsx        ← de volledige app (wizard, dashboard, login, rapport)
│  ├─ main.jsx        ← mount-punt (ReactDOM.createRoot)
│  └─ index.css        ← Tailwind + print-stijlen
├─ api/
│  ├─ claude.js        ← verbergt de Anthropic-sleutel, stuurt AI-aanvragen door
│  └─ generate-pdf.js  ← zet het rapport om naar een echt PDF-bestand
├─ supabase/
│  └─ schema.sql       ← database­structuur, uit te voeren in Supabase
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
via `npm run dev` **plus** `vercel dev` (zie stap 3) — met enkel `npm run dev` draaien de
`/api/*`-routes niet mee, want dat zijn Vercel-functies, geen Vite-routes.

Om ze wél lokaal te testen:
```bash
npm install -g vercel   # eenmalig
vercel dev
```

## 2. Supabase opzetten (database + login)

1. Maak een gratis project aan op [supabase.com](https://supabase.com).
2. **SQL Editor** → nieuwe query → plak de inhoud van `supabase/schema.sql` → **Run**.
3. **Project Settings → API** → noteer de **Project URL** en de **anon public key**.
   (De anon key is bewust publiek zichtbaar in de browser — dat is normaal bij Supabase;
   de echte beveiliging gebeurt via de rijregels in `schema.sql`.)
4. **Authentication → Providers** → controleer of "Confirm email" aan of uit staat naar wens
   (staat het aan, dan moet een nieuwe makelaar eerst een bevestigingsmail volgen vóór het
   eerste keer aanmelden — de app vangt dat geval netjes op).
5. Medewerkers toevoegen kan op twee manieren: ze registreren zichzelf via het tabblad
   "Nieuwe makelaar" in de app, of jij voegt ze toe via **Authentication → Users → Add user**.

## 3. Anthropic API-sleutel

1. Maak een sleutel aan op [console.anthropic.com](https://console.anthropic.com) → API keys.
2. Stel meteen een **uitgavenlimiet** in (Settings → Limits).

## 4. Hosten op Vercel

1. Push dit project naar een Git-repository (GitHub/GitLab/Bitbucket).
2. Ga naar [vercel.com](https://vercel.com) → **New Project** → importeer de repository.
   Vercel herkent dit automatisch als een Vite-project; de map `/api` wordt automatisch
   als serverless functies gehost.
3. Zet in **Project Settings → Environment Variables** deze drie sleutels:
   - `ANTHROPIC_API_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy.** `vercel.json` verlengt de looptijd van de twee functies al naar 30 seconden
   (het opstarten van de onzichtbare browser voor de PDF kost enkele seconden).
5. Optioneel: **Domains** om een eigen domein te koppelen (bv. `taxatie.houpels.be`).

## Bekende grenzen

- **Foto's/documenten** worden (zoals in de oorspronkelijke app) als base64 in de
  dossier-JSON bewaard, niet in Supabase Storage. Dat houdt de PDF-export exact zoals ze
  was, zonder extra upload-stap. Vercel-serverless-functies accepteren wel maximaal **4,5 MB**
  aan aanvraaggegevens (een platformlimiet, los van elke code-instelling) — bij dossiers met
  veel foto's kan het genereren van de PDF of het uitlezen van documenten daardoor falen.
  Zie je dat gebeuren, dan is de volgende stap: foto's naar een Supabase Storage-bucket
  uploaden en enkel de link opslaan (het patroon staat al klaar in de geschiedenis van dit
  project / de vroegere `frontend-storage-supabase.js`-referentie).
- Rolverdeling (wie ziet welke dossiers) staat nog open in de database: elke ingelogde
  makelaar kán bij elk dossier (de app zelf toont in het dashboard enkel eigen dossiers).
  Wil je dat ook op databaseniveau afschermen, pas dan de policies in `supabase/schema.sql`
  aan (`owner_id = auth.uid()` in plaats van `auth.role() = 'authenticated'`).
- Geen automatische back-ups buiten wat Supabase standaard voorziet.
