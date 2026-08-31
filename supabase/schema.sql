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

-- eigen "account"-gegevens van elke makelaar (via het nieuwe "Mijn account"-scherm in de app):
-- telefoonnummer, beroepstitel, BIV- en Vlabel-nummer — worden bij elk NIEUW dossier automatisch
-- ingevuld bij "Identificatie schatter-expert" (zie handleNew() in App.jsx), zodat een makelaar dit
-- niet telkens opnieuw moet intypen.
alter table public.profielen add column if not exists telefoon text not null default '';
alter table public.profielen add column if not exists titel text not null default 'Vastgoedmakelaar - Vlabel-erkend schatter';
alter table public.profielen add column if not exists biv_nummer text not null default '';
alter table public.profielen add column if not exists vlabel_nummer text not null default '';

-- tijdstip waarop deze gebruiker de gebruiksvoorwaarden heeft aanvaard (verplicht vinkje bij
-- "Nieuwe makelaar" in de app) — dient als bewijs van akkoord. Blijft leeg (null) voor accounts
-- die al bestonden vóór dit vinkje werd toegevoegd; dat is niet met terugwerkende kracht op te
-- lossen.
alter table public.profielen add column if not exists voorwaarden_geaccepteerd_op timestamptz;

-- automatisch een profiel aanmaken zodra iemand een account krijgt — "voorwaarden_geaccepteerd_op"
-- wordt hier op "nu" gezet omdat de app een account pas laat aanmaken nadat het vinkje bij de
-- gebruiksvoorwaarden is aangevinkt (zie submitRegister() in App.jsx): op het moment dat deze
-- trigger vuurt, is er dus altijd net akkoord gegaan.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profielen (id, naam, email, voorwaarden_geaccepteerd_op)
  values (new.id, coalesce(new.raw_user_meta_data->>'naam', new.email), new.email, now());
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
  owner_id uuid references auth.users(id) on delete set null,
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

-- FIX (kritiek): owner_id stond oorspronkelijk "not null ... on delete cascade" — het verwijderen
-- van een makelaar-account (bv. een vertrekkende collega, opgeruimd via Supabase Auth) verwijderde
-- daardoor stilzwijgend ALLE dossiers van die makelaar mee, zonder enige mogelijkheid om ze eerst
-- over te dragen. De onderstaande twee regels zijn enkel nodig als deze tabel al eerder is
-- aangemaakt (op een gloednieuwe database doet de "create table if not exists" hierboven dit al
-- meteen goed) — vandaar apart en idempotent, net als de rest van dit bestand.
alter table public.dossiers alter column owner_id drop not null;
alter table public.dossiers drop constraint if exists dossiers_owner_id_fkey;
alter table public.dossiers add constraint dossiers_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete set null;

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

-- "or public.is_beheerder()" hieronder is nodig omdat het opslaan van een dossier via een
-- "upsert" gebeurt (zie saveDossier() in App.jsx): Postgres past bij zo'n upsert altijd eerst de
-- WITH CHECK van het INSERT-beleid toe op de aangeboden rij, ook als er uiteindelijk een gewone
-- UPDATE van een bestaande rij gebeurt via ON CONFLICT. Zonder deze uitzondering kreeg een
-- beheerder die een dossier van een collega bewerkt (owner_id = de collega, niet de beheerder)
-- de fout "new row violates row-level security policy for table dossiers" bij elke opslag.
drop policy if exists "ingelogde medewerkers maken dossiers aan" on public.dossiers;
create policy "ingelogde medewerkers maken dossiers aan"
  on public.dossiers for insert
  with check (auth.role() = 'authenticated' and (owner_id = auth.uid() or public.is_beheerder()));

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

-- FIX (kritiek): stond eerst op "auth.role() = 'authenticated'" — daarmee kon élke ingelogde
-- makelaar de VOLLEDIGE profielen-tabel van alle collega's uitlezen (incl. telefoon, BIV- en
-- Vlabel-nummer), niet enkel de eigen rij. Enkel de eigen rij, of alles als je beheerder bent
-- (nodig voor de huisstijl-weergave bij het openen van een collega's dossier, zie hierboven).
drop policy if exists "eigen profiel lezen" on public.profielen;
create policy "eigen profiel lezen"
  on public.profielen for select
  using (id = auth.uid() or public.is_beheerder());

-- nodig voor het "Mijn account"-scherm: elke gebruiker mag enkel de EIGEN profielrij bewerken
-- (naam, telefoon, titel, BIV-/Vlabel-nummer) — niet die van een collega.
drop policy if exists "eigen profiel bewerken" on public.profielen;
create policy "eigen profiel bewerken"
  on public.profielen for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- FIX (kritiek): het beleid hierboven controleert enkel OF je de eigen rij mag aanpassen, niet
-- WELKE KOLOMMEN — dat is in Postgres een aparte laag (kolomrechten), die hier ontbrak. Zonder
-- deze twee regels kon elke ingelogde gebruiker, rechtstreeks via de Supabase-client en buiten de
-- app om, de EIGEN "rol"-kolom naar 'beheerder' zetten — en daarmee via is_beheerder() hierboven
-- in één stap volledige lees-/schrijf-/verwijdertoegang krijgen tot de dossiers van alle collega's.
-- Enkel de kolommen die het "Mijn account"-scherm effectief laat wijzigen, staan hieronder open;
-- "rol", "id" en "email" staan er bewust NIET bij.
revoke update on table public.profielen from authenticated;
grant update (naam, telefoon, titel, biv_nummer, vlabel_nummer) on public.profielen to authenticated;

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

-- FIX (kritiek): de drie beleidsregels hieronder controleerden voorheen enkel de bucket zelf en
-- "ben je ingelogd" — anders dan bij de dossiers-tabel werd nergens gecheckt of de map waarin het
-- bestand staat (elk pad begint met "<dossier_id>/...", zie hierboven) wel van de aanvrager is.
-- Daardoor kon elke ingelogde makelaar die een dossier-id van een collega kende (of raadde) diens
-- foto's/documenten lezen, overschrijven of verwijderen. "storage.foldername(name)" splitst het
-- pad op in mapdelen; deel [1] is daarin steeds het dossier-id.
drop policy if exists "medewerkers lezen bijlagen" on storage.objects;
create policy "medewerkers lezen bijlagen"
  on storage.objects for select
  using (
    bucket_id = 'dossier-bijlagen'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.dossiers d
      where d.id::text = (storage.foldername(name))[1]
        and (d.owner_id = auth.uid() or public.is_beheerder())
    )
  );

drop policy if exists "medewerkers uploaden bijlagen" on storage.objects;
create policy "medewerkers uploaden bijlagen"
  on storage.objects for insert
  with check (
    bucket_id = 'dossier-bijlagen'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.dossiers d
      where d.id::text = (storage.foldername(name))[1]
        and (d.owner_id = auth.uid() or public.is_beheerder())
    )
  );

drop policy if exists "medewerkers verwijderen bijlagen" on storage.objects;
create policy "medewerkers verwijderen bijlagen"
  on storage.objects for delete
  using (
    bucket_id = 'dossier-bijlagen'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.dossiers d
      where d.id::text = (storage.foldername(name))[1]
        and (d.owner_id = auth.uid() or public.is_beheerder())
    )
  );
