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
-- net als set_laatst_bewerkt hieronder met een vastgezet search_path (linterpunt), en met
-- ingetrokken uitvoerrechten verderop: deze functie hoort enkel als trigger te draaien, niet
-- oproepbaar te zijn via de publieke API
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profielen (id, naam, email, voorwaarden_geaccepteerd_op)
  values (new.id, coalesce(new.raw_user_meta_data->>'naam', new.email), new.email, now());
  return new;
end;
$$;

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
  data jsonb not null default '{}'::jsonb,
  -- Foto's, documenten en de voorpaginafoto staan in een APARTE kolom, los van "data": zo hoeft een
  -- gewone tekstwijziging niet telkens alle bijlagen opnieuw mee te sturen (zie saveDossier in
  -- App.jsx). Deze kolom stond eerder enkel in SUPABASE_MIGRATIE.sql en ontbrak hier — een databank
  -- die vanuit dit bestand werd opgebouwd (herstel na een incident, een testomgeving) miste ze dus,
  -- waarna de app terugviel op de oude opslagweg en een volgende bewaarbeurt de bijlagen van een
  -- dossier stil kon overschrijven. Daarom staat ze nu ook hier.
  media jsonb
);
-- ook voor databanken die al bestonden vóór deze kolom er was (idempotent, net als de rest)
alter table public.dossiers add column if not exists media jsonb;

create index if not exists dossiers_owner_idx on public.dossiers (owner_id);
create index if not exists dossiers_laatst_bewerkt_idx on public.dossiers (laatst_bewerkt desc);
create index if not exists dossiers_zoek_idx on public.dossiers using gin (
  to_tsvector('simple', straat || ' ' || postcode || ' ' || gemeente)
);

-- laatst_bewerkt automatisch bijwerken bij elke wijziging
-- "set search_path" is hier bewust vastgezet: zonder dat kan de functie bij uitvoering een ander
-- schema meekrijgen dan bedoeld (de Supabase-linter meldt dit als "function search path mutable").
create or replace function public.set_laatst_bewerkt()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.laatst_bewerkt = now();
  return new;
end;
$$;

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
-- Let op de expliciete "with check": zonder die regel past Postgres de "using"-voorwaarde stil ook
-- toe op de nieuwe rij. Dat werkt vandaag correct, maar het steunt dan op impliciet gedrag terwijl
-- de insert-regel hierboven het wél expliciet zegt. Nu staat het er in beide gevallen zwart op wit,
-- zodat een latere wijziging aan de ene regel de andere niet ongemerkt kan uithollen.
create policy "eigen dossiers bewerken of beheerder"
  on public.dossiers for update
  using (owner_id = auth.uid() or public.is_beheerder())
  with check (owner_id = auth.uid() or public.is_beheerder());

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
-- De onderstaande "insert" maakt de bucket zelf aan (privé, naam "dossier-bijlagen") — dat kan
-- ook via Supabase Dashboard > Storage > "New bucket", maar hoeft niet: dit bestand doet het al.
--
-- Bestanden worden dan opgeslagen als: dossier-bijlagen/<dossier_id>/<bestandsnaam>
-- In de "data"-JSON van elk dossier bewaar je enkel het bestandspad, niet meer
-- de volledige base64-inhoud — dat houdt de database licht en snel.

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

-- Overschrijven van een bestaand bestand (upsert) had geen eigen regel: de app laadt bijlagen op met
-- "upsert: true", en zonder deze regel faalt een echte overschrijving (bv. een document dat na een
-- mislukte poging opnieuw wordt opgeladen onder hetzelfde pad).
drop policy if exists "medewerkers overschrijven bijlagen" on storage.objects;
create policy "medewerkers overschrijven bijlagen"
  on storage.objects for update
  using (
    bucket_id = 'dossier-bijlagen'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.dossiers d
      where d.id::text = (storage.foldername(name))[1]
        and (d.owner_id = auth.uid() or public.is_beheerder())
    )
  )
  with check (
    bucket_id = 'dossier-bijlagen'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.dossiers d
      where d.id::text = (storage.foldername(name))[1]
        and (d.owner_id = auth.uid() or public.is_beheerder())
    )
  );

-- handle_new_user() draait uitsluitend als trigger op auth.users en hoort niet oproepbaar te zijn
-- via de publieke API (/rest/v1/rpc/...). Het uitvoerrecht wordt hier dus ingetrokken (linterpunt).
-- LET OP de eerste regel: Postgres geeft bij het aanmaken van een functie standaard EXECUTE aan
-- PUBLIC — enkel intrekken bij anon/authenticated volstaat dus niet, de functie blijft dan gewoon
-- oproepbaar. (De trigger zelf blijft werken: die controleert het uitvoerrecht van de aanroeper niet.)
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon, authenticated;

-- is_beheerder() wordt BEWUST NIET ingetrokken, ook al meldt de linter ze. Deze functie wordt
-- opgeroepen binnen de toegangsregels hierboven, en Postgres evalueert die regels met de rechten
-- van de aanvragende gebruiker: zonder uitvoerrecht faalt elke query op dossiers met "permission
-- denied for function is_beheerder" — dat legt de hele app plat. De blootstelling is bovendien
-- verwaarloosbaar: de functie geeft enkel terug of de OPROEPER zelf beheerder is, dus wie ze via
-- de API aanroept, verneemt niets wat hij niet al weet.

-- FIX (kritiek, aanvullend): een bijlage mag enkel een redelijk bestandstype/-grootte hebben — de
-- app zelf controleert dit nu ook (zie App.jsx, addDocumenten/addFotos), maar dat is enkel een
-- kliëntcontrole. Deze twee instellingen op de bucket zelf zijn de bijhorende serverzijdige grens:
-- Supabase weigert een upload die ze overschrijdt, ongeacht via welke weg (app, curl, ...) hij komt.
update storage.buckets set
  file_size_limit = 31457280, -- 30MB, gelijk aan MAX_DOC_BYTES in api/claude.js
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain']
where id = 'dossier-bijlagen';

-- ----------------------------------------------------------------------------
-- 5. LOGBOEK (audit trail) — wie maakte een dossier aan, verwijderde het, of sprong als
--    beheerder in het dossier van een collega?
-- ----------------------------------------------------------------------------
-- FIX (hoog): er bestond nergens een spoor van wie een dossier aanmaakte of verwijderde, of
-- wanneer een beheerder ingreep in het dossier van een collega — bij een geschil of vergissing
-- rond een document dat jarenlang juridisch relevant kan blijven (Vlabel/nalatenschap), was dat
-- achteraf nergens meer te reconstrueren. "dossier_id" heeft BEWUST geen foreign key naar
-- "dossiers": een "verwijderd"-gebeurtenis wordt pas gelogd NADAT de dossier-rij al weg is, dus
-- een foreign key zou net die (belangrijkste) logregel elke keer laten mislukken.
create table if not exists public.dossier_events (
  id bigint generated always as identity primary key,
  dossier_id uuid,
  gebruiker_id uuid references auth.users(id) on delete set null,
  actie text not null check (actie in ('aangemaakt', 'gewijzigd', 'verwijderd', 'geopend_door_beheerder')),
  details jsonb,
  aangemaakt_op timestamptz not null default now()
);

create index if not exists dossier_events_dossier_idx on public.dossier_events (dossier_id);
create index if not exists dossier_events_tijd_idx on public.dossier_events (aangemaakt_op desc);

alter table public.dossier_events enable row level security;

-- enkel beheerders mogen het logboek raadplegen (het is precies bedoeld als controlemiddel op,
-- onder andere, beheerders zelf — een gewone makelaar hoeft en mag dit niet kunnen inzien)
drop policy if exists "beheerder leest logboek" on public.dossier_events;
create policy "beheerder leest logboek"
  on public.dossier_events for select
  using (public.is_beheerder());

-- elke ingelogde gebruiker mag een gebeurtenis loggen, maar uitsluitend op eigen naam (nooit
-- "gebruiker_id" van iemand anders invullen) — en nergens een update- of delete-beleid: eenmaal
-- weggeschreven, is een logregel niet meer te wijzigen of te verwijderen via de gewone app-toegang.
drop policy if exists "ingelogde gebruikers loggen eigen acties" on public.dossier_events;
create policy "ingelogde gebruikers loggen eigen acties"
  on public.dossier_events for insert
  with check (auth.role() = 'authenticated' and gebruiker_id = auth.uid());
