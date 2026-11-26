-- ============================================================================
-- AI-VERBRUIK PER ACCOUNT
-- ============================================================================
-- Eén rij per AI-aanroep via /api/claude (zie api/claude.js): wie, welke functie, welk model,
-- hoeveel tokens en webzoekopdrachten, en de geschatte kost aan catalogusprijs (USD, excl. btw).
-- De Anthropic Console kent enkel de ene API-sleutel van de app en ziet dus niet WELKE
-- gebruiker het verbruik veroorzaakt — deze tabel wel.
--
-- Schrijven: api/claude.js schrijft de rij weg met het sessietoken van de ingelogde gebruiker
-- (geen geheime service-sleutel nodig), dus enkel voor zichzelf (gebruiker_id = auth.uid()).
-- Er is bewust geen update- of delete-regel: een gebruiker kan eigen verbruik niet wissen of
-- verlagen.
-- Lezen: de platform-beheerder ziet alles, een kantoor-beheerder het eigen kantoor, een gewone
-- gebruiker enkel de eigen rijen (zelfde regel als het dossierlogboek, zie dossier_events).
-- ============================================================================

create table if not exists public.ai_verbruik (
  id bigint generated always as identity primary key,
  gebruiker_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email text,
  kantoor_id uuid references public.kantoren(id),
  functie text not null default 'onbekend',
  model text not null,
  invoer_tokens integer not null default 0,
  uitvoer_tokens integer not null default 0,
  cache_schrijf_tokens integer not null default 0,
  cache_lees_tokens integer not null default 0,
  webzoekopdrachten integer not null default 0,
  kosten_usd numeric(12,6) not null default 0,
  aangemaakt_op timestamptz not null default now()
);

create index if not exists ai_verbruik_tijd_idx on public.ai_verbruik (aangemaakt_op desc);
create index if not exists ai_verbruik_gebruiker_idx on public.ai_verbruik (gebruiker_id, aangemaakt_op desc);
create index if not exists ai_verbruik_kantoor_idx on public.ai_verbruik (kantoor_id);

alter table public.ai_verbruik enable row level security;

-- kantoor automatisch invullen vanuit het profiel (zelfde functie als bij dossier_events)
drop trigger if exists ai_verbruik_zet_kantoor on public.ai_verbruik;
create trigger ai_verbruik_zet_kantoor
  before insert on public.ai_verbruik
  for each row execute function public.zet_kantoor_bij_nieuwe_gebeurtenis();

drop policy if exists "ingelogde gebruikers loggen eigen ai-verbruik" on public.ai_verbruik;
create policy "ingelogde gebruikers loggen eigen ai-verbruik"
  on public.ai_verbruik for insert
  with check (auth.role() = 'authenticated' and gebruiker_id = auth.uid());

drop policy if exists "eigen ai-verbruik of beheerder leest" on public.ai_verbruik;
create policy "eigen ai-verbruik of beheerder leest"
  on public.ai_verbruik for select
  using (gebruiker_id = auth.uid() or public.mag_kantoor_beheren(kantoor_id));
