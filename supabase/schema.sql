-- ============================================================================
-- SUPABASE-SCHEMA voor Houpels Valuation & Real Estate — Taxatie-app
-- ============================================================================
-- Uitvoeren in: Supabase Dashboard > SQL Editor > "New query" > plakken > Run
--
-- Dit vervangt de huidige window.storage (enkel beschikbaar binnen Claude.ai)
-- door een echte, permanente database met gebruikersaccounts.
--
-- Dit bestand is veilig om opnieuw volledig uit te voeren (alle create/drop-
-- statements zijn idempotent) — dat is ook hoe je een latere aanpassing zoals
-- hieronder toepast: gewoon het hele bestand opnieuw plakken en Run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. GEBRUIKERS (makelaars)
-- ----------------------------------------------------------------------------
-- Supabase heeft al een ingebouwd, veilig gebruikerssysteem (auth.users) met
-- gehashte wachtwoorden, wachtwoord-reset per mail, enz. — dat vervangt de
-- huidige DEMO_USER/makelaars_users-opslag met platte wachtwoorden volledig.
-- Je hoeft hier zelf niets voor aan te maken; medewerkers worden aangemaakt via
-- Supabase Auth (zie README, stap "Medewerkers toevoegen").

-- Optioneel: een klein profiel-tabelletje gekoppeld aan elke gebruiker, voor
-- weergavenaam en rol (bv. "makelaar" of "beheerder").
create table if not exists public.profielen (
  id uuid primary key references auth.users(id) on delete cascade,
  naam text not null default '',
  rol text not null default 'makelaar' check (rol in ('makelaar', 'beheerder')),
  aangemaakt_op timestamptz not null default now()
);

-- e-mailadres van elke gebruiker, gespiegeld vanuit auth.users (dat de browser niet rechtstreeks
-- mag/kan opvragen voor ANDERE gebruikers dan zichzelf). Nodig zodat een beheerder, bij het openen
-- van een dossier van een collega, de huisstijl (Houpels/Huyzen) van de EIGENAAR van dat dossier
-- kan tonen in plaats van steeds de eigen huisstijl van de ingelogde beheerder — zie kiesHuisstijl()
-- in App.jsx. "if not exists" + de update eronder zorgen dat dit ook veilig is op een database die
-- deze kolom al eerder kreeg via een vorige uitvoering van dit bestand.
alter table public.profielen add column if not exists email text not null default '';
-- vult de kolom eenmalig in voor bestaande accounts (nieuwe accounts krijgen dit automatisch mee
-- via de trigger hieronder)
update public.profielen p set email = u.email from auth.users u where p.id = u.id and p.email = '';

-- automatisch een profiel aanmaken zodra iemand een account krijgt
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profielen (id, naam, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'naam', new.email), new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Hulpfunctie: is de ingelogde gebruiker een "beheerder" (admin)? Wordt gebruikt
-- in de toegangsregels hieronder zodat een beheerder in élk dossier kan
-- inspringen, terwijl een gewone makelaar enkel de eigen dossiers ziet/bewerkt.
-- "security definer" is nodig zodat deze functie de profielen-tabel mag lezen
-- ongeacht de rijregels erop (anders zou de check zichzelf blokkeren).
create or replace function public.is_beheerder()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profielen
    where id = auth.uid() and rol = 'beheerder'
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. DOSSIERS
-- ----------------------------------------------------------------------------
-- De volledige dossier-inhoud (alle ~150 velden uit initialData) wordt als
-- JSON bewaard in de kolom "data" — net zoals dat nu al gebeurt in
-- window.storage. Enkel de velden die het dashboard nodig heeft om dossiers
-- te tonen/doorzoeken, staan als aparte, doorzoekbare kolommen.
create table if not exists public.dossiers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  straat text not null default '',
  nummer text not null default '',
  bus text not null default '',
  postcode text not null default '',
  gemeente text not null default '',
  status text not null default 'concept' check (status in ('concept', 'afgewerkt')),
  aangemaakt_op timestamptz not null default now(),
  laatst_bewerkt timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);

create index if not exists dossiers_owner_idx on public.dossiers (owner_id);
create index if not exists dossiers_laatst_bewerkt_idx on public.dossiers (laatst_bewerkt desc);
create index if not exists dossiers_zoek_idx on public.dossiers using gin (
  to_tsvector('simple', straat || ' ' || postcode || ' ' || gemeente)
);

-- laatst_bewerkt automatisch bijwerken bij elke wijziging
create or replace function public.set_laatst_bewerkt()
returns trigger as $$
begin
  new.laatst_bewerkt = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists dossiers_laatst_bewerkt_trigger on public.dossiers;
create trigger dossiers_laatst_bewerkt_trigger
  before update on public.dossiers
  for each row execute procedure public.set_laatst_bewerkt();

-- ----------------------------------------------------------------------------
-- 3. TOEGANGSREGELS (Row Level Security)
-- ----------------------------------------------------------------------------
-- Elke ingelogde makelaar ziet en bewerkt enkel zijn/haar EIGEN dossiers
-- (owner_id = auth.uid()). Een gebruiker met rol "beheerder" in de
-- profielen-tabel ziet en bewerkt daarnaast ALLE dossiers (bv. om in te
-- springen op een taxatie van een collega).
--
-- Om jezelf beheerder te maken: Supabase Dashboard > Table Editor > profielen
-- > zoek je eigen rij (op naam/e-mail) > zet de kolom "rol" op "beheerder".

alter table public.dossiers enable row level security;
alter table public.profielen enable row level security;

drop policy if exists "ingelogde medewerkers zien alle dossiers" on public.dossiers;
drop policy if exists "eigen dossiers of beheerder ziet alles" on public.dossiers;
create policy "eigen dossiers of beheerder ziet alles"
  on public.dossiers for select
  using (owner_id = auth.uid() or public.is_beheerder());

drop policy if exists "ingelogde medewerkers maken dossiers aan" on public.dossiers;
create policy "ingelogde medewerkers maken dossiers aan"
  on public.dossiers for insert
  with check (auth.role() = 'authenticated' and owner_id = auth.uid());

drop policy if exists "ingelogde medewerkers bewerken alle dossiers" on public.dossiers;
drop policy if exists "eigen dossiers bewerken of beheerder" on public.dossiers;
create policy "eigen dossiers bewerken of beheerder"
  on public.dossiers for update
  using (owner_id = auth.uid() or public.is_beheerder());

drop policy if exists "ingelogde medewerkers verwijderen alle dossiers" on public.dossiers;
drop policy if exists "eigen dossiers verwijderen of beheerder" on public.dossiers;
create policy "eigen dossiers verwijderen of beheerder"
  on public.dossiers for delete
  using (owner_id = auth.uid() or public.is_beheerder());

drop policy if exists "eigen profiel lezen" on public.profielen;
create policy "eigen profiel lezen"
  on public.profielen for select
  using (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 4. BESTANDSOPSLAG (foto's & documenten)
-- ----------------------------------------------------------------------------
-- Voer dit uit via Supabase Dashboard > Storage > "New bucket", niet via SQL:
--   Naam: dossier-bijlagen
--   Public: NEE (privé — enkel ingelogde medewerkers mogen erbij)
--
-- Bestanden worden dan opgeslagen als: dossier-bijlagen/<dossier_id>/<bestandsnaam>
-- In de "data"-JSON van elk dossier bewaar je enkel het bestandspad, niet meer
-- de volledige base64-inhoud — dat houdt de database licht en snel.
--
-- Nadat de bucket is aangemaakt, voer je hieronder de toegangsregels ervoor uit:

insert into storage.buckets (id, name, public)
values ('dossier-bijlagen', 'dossier-bijlagen', false)
on conflict (id) do nothing;

drop policy if exists "medewerkers lezen bijlagen" on storage.objects;
create policy "medewerkers lezen bijlagen"
  on storage.objects for select
  using (bucket_id = 'dossier-bijlagen' and auth.role() = 'authenticated');

drop policy if exists "medewerkers uploaden bijlagen" on storage.objects;
create policy "medewerkers uploaden bijlagen"
  on storage.objects for insert
  with check (bucket_id = 'dossier-bijlagen' and auth.role() = 'authenticated');

drop policy if exists "medewerkers verwijderen bijlagen" on storage.objects;
create policy "medewerkers verwijderen bijlagen"
  on storage.objects for delete
  using (bucket_id = 'dossier-bijlagen' and auth.role() = 'authenticated');
