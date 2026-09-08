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

-- ----------------------------------------------------------------------------
-- 6. MULTI-TENANCY (kantoren)
-- ----------------------------------------------------------------------------
-- Tot hier was deze app gebouwd voor ÉÉN bedrijf met twee huisstijlen (Houpels/Huyzen), niet voor
-- meerdere onafhankelijke klanten: "beheerder" hierboven betekende steeds "ziet ALLE dossiers in de
-- hele database", en de huisstijl werd enkel op het e-mailadres van de gebruiker gebaseerd
-- (kiesHuisstijl in constants.js) — nergens in de database stond vastgelegd bij welk bedrijf een
-- gebruiker of dossier hoort. Zodra deze app ook aan ANDERE, onderling niet-verbonden kantoren
-- wordt aangeboden, is dat een datalek in wording: een "beheerder" van kantoor B zou zo elk dossier
-- van kantoor A kunnen zien. Dit onderdeel voert de eigenlijke scheiding in, zonder de bestaande
-- rollen/functionaliteit (rol "makelaar"/"beheerder", is_beheerder(), de huisstijl-weergave) op dit
-- moment al te herschrijven — dat gebeurt in een latere stap (het instellingenscherm per kantoor).
-- Deze migratie raakt bewust geen frontend-code aan: de dossier-/dossierlijst-opvraging in de app
-- doet vandaag al GEEN eigen filtering (die vertrouwt volledig op wat de toegangsregels hieronder
-- teruggeven) — dus zodra de regels hier kantoorbewust zijn, is de app dat automatisch mee.

create table if not exists public.kantoren (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  -- huisstijl — vervangt op termijn de hardcoded HUISSTIJLEN-lijst in constants.js
  kleur text not null default '#8C6A2F',
  logo text,
  adres text not null default '',
  telefoon text not null default '',
  email text not null default '',
  actief boolean not null default true,
  aangemaakt_op timestamptz not null default now()
);

-- de twee bestaande "huisstijlen" worden de eerste twee kantoren — bestaat dit kantoor al (zelfde
-- naam), dan gebeurt hier niets (idempotent, net als de rest van dit bestand)
insert into public.kantoren (naam, kleur, logo, actief)
select 'Houpels Valuation & Real Estate', '#8C6A2F', null, true
where not exists (select 1 from public.kantoren where naam = 'Houpels Valuation & Real Estate');

insert into public.kantoren (naam, kleur, logo, actief)
select 'Huyzen Vastgoed', '#0093D3', null, true
where not exists (select 1 from public.kantoren where naam = 'Huyzen Vastgoed');

-- "profielen" en "dossiers" horen voortaan bij precies één kantoor. Eerst toevoegen zonder
-- "not null" (bestaande rijen hebben nog geen waarde), dan de bestaande rijen vullen, dan pas
-- "not null" afdwingen — anders faalt de ALTER TABLE meteen op een niet-lege tabel.
alter table public.profielen add column if not exists kantoor_id uuid references public.kantoren(id);
alter table public.dossiers add column if not exists kantoor_id uuid references public.kantoren(id);

-- vult bestaande profielen in met dezelfde e-maildomein-regel als kiesHuisstijl() in constants.js
-- vandaag al gebruikt (@huyzen.be -> Huyzen Vastgoed, alle andere -> Houpels) — dit zet dus NIETS
-- om voor bestaande gebruikers, het legt enkel vast in de database wat de app al die tijd impliciet
-- via het e-mailadres afleidde.
update public.profielen set kantoor_id = (select id from public.kantoren where naam = 'Huyzen Vastgoed')
  where kantoor_id is null and lower(email) like '%@huyzen.be';
update public.profielen set kantoor_id = (select id from public.kantoren where naam = 'Houpels Valuation & Real Estate')
  where kantoor_id is null;

-- dossiers volgen het kantoor van hun eigenaar; een dossier zonder eigenaar meer (account
-- verwijderd, owner_id staat dan op null, zie de fix hierboven) krijgt het standaardkantoor zodat
-- de kolom hierna altijd een waarde heeft — zo'n dossier blijft daardoor enkel zichtbaar voor een
-- beheerder van dat standaardkantoor (of de platform-beheerder hieronder), nooit "van niemand".
update public.dossiers d set kantoor_id = p.kantoor_id
  from public.profielen p where d.owner_id = p.id and d.kantoor_id is null;
update public.dossiers set kantoor_id = (select id from public.kantoren where naam = 'Houpels Valuation & Real Estate')
  where kantoor_id is null;

alter table public.profielen alter column kantoor_id set not null;
alter table public.dossiers alter column kantoor_id set not null;

create index if not exists profielen_kantoor_idx on public.profielen (kantoor_id);
create index if not exists dossiers_kantoor_idx on public.dossiers (kantoor_id);

-- FIX (kritiek): zonder deze kolomrechten-restrictie voorkomt niets dat iemand rechtstreeks via de
-- Supabase-client, buiten de app om, het EIGEN dossier naar een ander kantoor "verhuist" (en zo
-- ofwel de eigen gegevens aan een andere beheerder blootstelt, ofwel zich toegang verschaft tot een
-- kantoor waar hij geen rol in heeft) — kantoor_id ligt daarom vast bij het aanmaken van een
-- dossier (zie de trigger hieronder) en is nadien niet meer via een gewone update wijzigbaar.
-- LET OP: een REVOKE UPDATE enkel op de kolom zelf volstaat hier NIET — "authenticated" heeft al
-- een bredere, tabelbrede UPDATE-toelating (dezelfde soort brede standaardtoelating als hierboven
-- bij "profielen" bestond, zie de FIX daar), en die blijft alle kolommen dekken totdat ze zelf
-- wordt ingetrokken. Daarom eerst de volledige tabel intrekken en dan alle kolommen BEHALVE
-- "kantoor_id" expliciet terug toekennen — exact hetzelfde patroon als bij "profielen" hierboven.
-- (Empirisch bevestigd bij het opstellen van deze migratie: een kale kolom-REVOKE liet de update
-- alsnog gewoon toe.)
revoke update on table public.dossiers from authenticated;
grant update (id, owner_id, straat, nummer, bus, postcode, gemeente, status, aangemaakt_op, laatst_bewerkt, data, media)
  on public.dossiers to authenticated;

-- zet, bij het aanmaken van een nieuw profiel (nieuwe-makelaar-registratie in de app, zie
-- submitRegister() in App.jsx), het kantoor op dezelfde manier als hierboven al voor bestaande
-- profielen gebeurde. Dit bewaart het HUIDIGE gedrag van de app exact (nieuwe medewerkers komen bij
-- Houpels of Huyzen terecht, net als vandaag) — een echte nieuwe, onafhankelijke klant toevoegen
-- gebeurt in een latere stap altijd via een gerichte toewijzing, nooit via deze val-terug-regel.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gekozen_kantoor uuid;
begin
  if lower(new.email) like '%@huyzen.be' then
    select id into gekozen_kantoor from public.kantoren where naam = 'Huyzen Vastgoed';
  else
    select id into gekozen_kantoor from public.kantoren where naam = 'Houpels Valuation & Real Estate';
  end if;
  insert into public.profielen (id, naam, email, kantoor_id, voorwaarden_geaccepteerd_op)
  values (new.id, coalesce(new.raw_user_meta_data->>'naam', new.email), new.email, gekozen_kantoor, now());
  return new;
end;
$$;

-- zet, bij het aanmaken van een nieuw dossier, kantoor_id ALTIJD zelf op basis van het profiel van
-- de eigenaar — ongeacht wat de aanvraag zelf eventueel meestuurt (de app stuurt dit veld vandaag
-- sowieso nooit mee, zie basisPayload in src/data/dossiers.js, maar deze functie steunt daar bewust
-- niet enkel op: zo blijft de scheiding gegarandeerd, ook als dat ooit verandert of iemand
-- rechtstreeks via de API een dossier aanmaakt). "security definer" is nodig omdat profielen zijn
-- eigen rijregels heeft; deze functie moet ze kunnen lezen ongeacht wie de aanvraag doet.
create or replace function public.zet_kantoor_bij_nieuw_dossier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select kantoor_id into new.kantoor_id from public.profielen where id = new.owner_id;
  return new;
end;
$$;

drop trigger if exists dossiers_zet_kantoor_trigger on public.dossiers;
create trigger dossiers_zet_kantoor_trigger
  before insert on public.dossiers
  for each row execute procedure public.zet_kantoor_bij_nieuw_dossier();

-- markeert jezelf (en eventueel later een klein aantal medewerkers) als "platform-beheerder": ziet
-- en beheert ALLE kantoren, nodig voor support en voor het aanmaken/blokkeren van nieuwe
-- klant-kantoren. Bewust een APARTE kolom, los van "rol" (makelaar/beheerder): een kantoor-beheerder
-- (rol = 'beheerder') blijft beperkt tot het EIGEN kantoor, ook al is dat verder identiek dezelfde
-- rol als vandaag. Net als bij "rol" hierboven: om jezelf platform-beheerder te maken, Supabase
-- Dashboard > Table Editor > profielen > eigen rij > "is_platform_beheerder" op waar zetten.
alter table public.profielen add column if not exists is_platform_beheerder boolean not null default false;

-- vervangt is_beheerder() (die "ziet ALLES, in elk kantoor" betekent) in de toegangsregels
-- hieronder door een kantoorbewuste versie: een kantoor-beheerder ziet enkel het MEEGEGEVEN
-- kantoor, een platform-beheerder ziet elk kantoor. is_beheerder() zelf blijft ongewijzigd bestaan
-- (nog steeds correct als antwoord op "heeft deze gebruiker een beheerdersrol", overal elders waar
-- dat relevant kan zijn) — enkel de toegangsregels op dossiers/dossier_events/bijlagen hieronder
-- gebruiken voortaan deze nieuwe functie in plaats van is_beheerder().
create or replace function public.mag_kantoor_beheren(doel_kantoor uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profielen
    where id = auth.uid()
      and (is_platform_beheerder or (rol = 'beheerder' and kantoor_id = doel_kantoor))
  );
$$;

-- dezelfde vier dossier-toegangsregels als in onderdeel 3 hierboven, enkel met
-- "public.is_beheerder()" vervangen door "public.mag_kantoor_beheren(kantoor_id)" — een
-- kantoor-beheerder ziet/bewerkt/verwijdert voortaan enkel dossiers van het EIGEN kantoor, een
-- platform-beheerder alles.
drop policy if exists "eigen dossiers of beheerder ziet alles" on public.dossiers;
create policy "eigen dossiers of beheerder ziet alles"
  on public.dossiers for select
  using (owner_id = auth.uid() or public.mag_kantoor_beheren(kantoor_id));

drop policy if exists "ingelogde medewerkers maken dossiers aan" on public.dossiers;
create policy "ingelogde medewerkers maken dossiers aan"
  on public.dossiers for insert
  with check (auth.role() = 'authenticated' and (owner_id = auth.uid() or public.mag_kantoor_beheren(kantoor_id)));

drop policy if exists "eigen dossiers bewerken of beheerder" on public.dossiers;
create policy "eigen dossiers bewerken of beheerder"
  on public.dossiers for update
  using (owner_id = auth.uid() or public.mag_kantoor_beheren(kantoor_id))
  with check (owner_id = auth.uid() or public.mag_kantoor_beheren(kantoor_id));

drop policy if exists "eigen dossiers verwijderen of beheerder" on public.dossiers;
create policy "eigen dossiers verwijderen of beheerder"
  on public.dossiers for delete
  using (owner_id = auth.uid() or public.mag_kantoor_beheren(kantoor_id));

-- idem voor het lezen van een profiel: een kantoor-beheerder ziet voortaan enkel de profielen van
-- het EIGEN kantoor (nodig voor de huisstijl-weergave bij het openen van een collega's dossier,
-- zie kiesHuisstijl-toelichting elders), niet meer die van elk ander kantoor.
drop policy if exists "eigen profiel lezen" on public.profielen;
create policy "eigen profiel lezen"
  on public.profielen for select
  using (id = auth.uid() or public.mag_kantoor_beheren(kantoor_id));

-- idem voor de drie bijlage-regels (storage.objects) uit onderdeel 4 hierboven
drop policy if exists "medewerkers lezen bijlagen" on storage.objects;
create policy "medewerkers lezen bijlagen"
  on storage.objects for select
  using (
    bucket_id = 'dossier-bijlagen'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.dossiers d
      where d.id::text = (storage.foldername(name))[1]
        and (d.owner_id = auth.uid() or public.mag_kantoor_beheren(d.kantoor_id))
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
        and (d.owner_id = auth.uid() or public.mag_kantoor_beheren(d.kantoor_id))
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
        and (d.owner_id = auth.uid() or public.mag_kantoor_beheren(d.kantoor_id))
    )
  );

drop policy if exists "medewerkers overschrijven bijlagen" on storage.objects;
create policy "medewerkers overschrijven bijlagen"
  on storage.objects for update
  using (
    bucket_id = 'dossier-bijlagen'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.dossiers d
      where d.id::text = (storage.foldername(name))[1]
        and (d.owner_id = auth.uid() or public.mag_kantoor_beheren(d.kantoor_id))
    )
  )
  with check (
    bucket_id = 'dossier-bijlagen'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.dossiers d
      where d.id::text = (storage.foldername(name))[1]
        and (d.owner_id = auth.uid() or public.mag_kantoor_beheren(d.kantoor_id))
    )
  );

-- ook het logboek wordt kantoorbewust: een kantoor-beheerder leest voortaan enkel het logboek van
-- het EIGEN kantoor, een platform-beheerder alles. "kantoor_id" hier is bewust een gewone kolom
-- (net als dossier_id hierboven GEEN foreign key: een gebeurtenis over een intussen verwijderd
-- dossier/profiel moet toch leesbaar blijven), automatisch ingevuld bij het inloggen — zie de
-- trigger hieronder. Bewust NIET "not null": een gebeurtenis van een intussen verwijderde gebruiker
-- (gebeurtenis_id/gebruiker_id staat dan al op null, zie de kolomdefinitie hierboven) kan dan geen
-- kantoor meer afgeleid worden; zo'n gebeurtenis blijft dan enkel zichtbaar voor de
-- platform-beheerder, nooit onzichtbaar voor iedereen door een mislukte migratie.
alter table public.dossier_events add column if not exists kantoor_id uuid references public.kantoren(id);
update public.dossier_events e set kantoor_id = p.kantoor_id
  from public.profielen p where e.gebruiker_id = p.id and e.kantoor_id is null;

create or replace function public.zet_kantoor_bij_nieuwe_gebeurtenis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select kantoor_id into new.kantoor_id from public.profielen where id = new.gebruiker_id;
  return new;
end;
$$;

drop trigger if exists dossier_events_zet_kantoor_trigger on public.dossier_events;
create trigger dossier_events_zet_kantoor_trigger
  before insert on public.dossier_events
  for each row execute procedure public.zet_kantoor_bij_nieuwe_gebeurtenis();

drop policy if exists "beheerder leest logboek" on public.dossier_events;
create policy "beheerder leest logboek"
  on public.dossier_events for select
  using (public.mag_kantoor_beheren(kantoor_id));

-- ----------------------------------------------------------------------------
-- 7. HUISSTIJL PER KANTOOR (instellingenscherm + logo-upload)
-- ----------------------------------------------------------------------------
-- Onderdeel 6 hierboven legde vast bij welk kantoor elke gebruiker/dossier hoort, maar liet de
-- "kantoren"-tabel zelf nog volledig onbeschermd: geen "enable row level security", dus élke
-- ingelogde gebruiker kon via de Supabase-client vandaag al de naam/kleur/logo/adres/telefoon/
-- e-mail van OM HET EVEN WELK kantoor lezen ÉN overschrijven (de standaard-tabelrechten die
-- Supabase een nieuwe tabel meegeeft, zie de FIX-toelichtingen bij "profielen"/"dossiers"
-- hierboven, golden hier al die tijd ook al onverkort). Dit onderdeel sluit dat gat en voegt de
-- opslagplek voor kantoorlogo's toe, zodat elk kantoor voortaan zelf zijn huisstijl kan beheren
-- i.p.v. die hardcoded in constants.js te laten staan (zie kiesHuisstijl aldaar — vervangen door
-- een opvraging via kantoor_id, zie src/data/kantoren.js).

alter table public.kantoren enable row level security;

-- "eigen kantoor" i.p.v. "mag kantoor BEHEREN" (public.mag_kantoor_beheren hierboven): een gewone
-- makelaar moet de huisstijl van het EIGEN kantoor kunnen lezen (nodig om het rapport/dashboard
-- correct te tonen), ook al mag die ze niet bewerken — enkel een kantoor-beheerder of de
-- platform-beheerder mag dat (zie de update-regel verderop).
create or replace function public.eigen_kantoor(doel_kantoor uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profielen
    where id = auth.uid() and kantoor_id = doel_kantoor
  );
$$;

drop policy if exists "eigen kantoor lezen" on public.kantoren;
create policy "eigen kantoor lezen"
  on public.kantoren for select
  using (public.eigen_kantoor(id) or public.mag_kantoor_beheren(id));

-- FIX (kritiek, zelfde patroon als bij "profielen"/"dossiers" hierboven): een kale kolom-REVOKE
-- volstaat niet zolang de bredere tabelrechten van "authenticated" niet eerst ingetrokken zijn.
-- "actief" (kantoor blokkeren/deblokkeren) en "id"/"aangemaakt_op" staan BEWUST niet in de
-- kolomlijst hieronder: dat blijft, net als vandaag, iets voor de platform-beheerder via Supabase
-- Dashboard > Table Editor (zie ook de toelichting bij "is_platform_beheerder" hierboven) — een
-- kantoor-beheerder bewerkt enkel de huisstijl/contactgegevens van het EIGEN kantoor.
revoke update on table public.kantoren from authenticated;
grant update (naam, kleur, logo, adres, telefoon, email) on public.kantoren to authenticated;

drop policy if exists "kantoor-beheerder werkt huisstijl bij" on public.kantoren;
create policy "kantoor-beheerder werkt huisstijl bij"
  on public.kantoren for update
  using (public.mag_kantoor_beheren(id))
  with check (public.mag_kantoor_beheren(id));

-- geen insert/delete-toegangsregel: een nieuw kantoor aanmaken (nieuwe klant) of verwijderen
-- gebeurt vooralsnog uitsluitend handmatig door de platform-beheerder via Supabase Dashboard >
-- Table Editor (zie het stappenplan, Fase 3 — "eerst handmatig") — met RLS aan en zonder
-- bijhorende policy weigert Postgres zo'n insert/delete voor de "authenticated"-rol automatisch,
-- exact hetzelfde principe als hierboven al bij "dossier_events" gold (enkel select+insert, geen
-- update/delete-policy).

-- Logo-opslag: een PUBLIEKE bucket (in tegenstelling tot "dossier-bijlagen" hierboven, dat bewust
-- privé is) — het rapport en de webweergave moeten een kantoorlogo zonder ondertekende link kunnen
-- tonen, en een logo is sowieso geen vertrouwelijke bedrijfsinformatie. Bestandspad:
-- kantoor-logos/<kantoor_id>/logo.<extensie> — telkens hetzelfde pad per kantoor (upsert), dus een
-- nieuw logo vervangt gewoon het vorige zonder oude bestanden achter te laten. Een publieke bucket
-- omzeilt bovendien RLS op storage.objects voor het LEZEN van het bestand (de browser haalt het
-- rechtstreeks bij de publieke Storage-URL op, zie getPublicUrl() in src/data/kantoren.js) — enkel
-- schrijven (insert/update/delete) hieronder blijft dus RLS-gecontroleerd.
insert into storage.buckets (id, name, public)
values ('kantoor-logos', 'kantoor-logos', true)
on conflict (id) do nothing;

update storage.buckets set
  file_size_limit = 3145728, -- 3MB — ruim voldoende voor een logo, houdt het rapport/dashboard licht
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'kantoor-logos';

-- "storage.foldername(name)[1]" is hier het kantoor_id (zelfde constructie als bij
-- "dossier-bijlagen" hierboven, waar [1] het dossier_id is) — enkel de kantoor-beheerder van
-- precies dát kantoor (of de platform-beheerder) mag er een logo in plaatsen/overschrijven/
-- verwijderen. Geen aparte select-policy nodig: zie de toelichting over de publieke bucket hierboven.
drop policy if exists "kantoor-beheerder laadt logo op" on storage.objects;
create policy "kantoor-beheerder laadt logo op"
  on storage.objects for insert
  with check (
    bucket_id = 'kantoor-logos'
    and public.mag_kantoor_beheren(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "kantoor-beheerder overschrijft logo" on storage.objects;
create policy "kantoor-beheerder overschrijft logo"
  on storage.objects for update
  using (
    bucket_id = 'kantoor-logos'
    and public.mag_kantoor_beheren(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'kantoor-logos'
    and public.mag_kantoor_beheren(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "kantoor-beheerder verwijdert logo" on storage.objects;
create policy "kantoor-beheerder verwijdert logo"
  on storage.objects for delete
  using (
    bucket_id = 'kantoor-logos'
    and public.mag_kantoor_beheren(((storage.foldername(name))[1])::uuid)
  );

-- ----------------------------------------------------------------------------
-- 8. AUTOMATISCHE KANTOORTOEWIJZING VIA E-MAILDOMEIN (Fase 3 — onboarding)
-- ----------------------------------------------------------------------------
-- Tot hier moest een platform-beheerder NA elke individuele registratie handmatig het kantoor van
-- die persoon instellen (Table Editor > profielen > kantoor_id) — voor een kantoor met meerdere
-- medewerkers is dat een terugkerend handmatig werkje per nieuwe collega. Dit onderdeel veralgemeent
-- de truc die hierboven al specifiek voor "@huyzen.be" bestond: elk kantoor krijgt een eigen
-- e-maildomein, en de registratietrigger kijkt daar zelf naar. Een nieuw ONAFHANKELIJK kantoor
-- toevoegen blijft wél een eenmalige handmatige stap (iemand moet dat kantoor + zijn domein
-- vastleggen) — enkel het koppelen van de DAAROPVOLGENDE medewerkers gebeurt voortaan vanzelf.

alter table public.kantoren add column if not exists email_domein text;

-- voorkomt een dubbelzinnige toewijzing (twee kantoren die toevallig hetzelfde domein claimen) —
-- weigert dat al bij het instellen zelf i.p.v. stilzwijgend een van de twee te kiezen.
-- "lower(email_domein)" i.p.v. de kolom zelf: hoofdlettergevoeligheid mag nooit bepalen of een
-- domein als "bezet" geldt.
create unique index if not exists kantoren_email_domein_idx on public.kantoren (lower(email_domein))
  where email_domein is not null;

-- exact één kantoor is de "standaard" (het vangnet voor een e-mailadres dat bij geen enkel
-- ingesteld domein hoort — vandaag nog elk adres behalve @huyzen.be) — vervangt de hardcoded
-- "Houpels Valuation & Real Estate"-naam verderop in handle_new_user() door een instelbare vlag.
alter table public.kantoren add column if not exists is_standaardkantoor boolean not null default false;

-- eenmalige, idempotente omzetting van de HUIDIGE hardcoded regel naar de nieuwe, instelbare vorm
-- — "where email_domein is null"/"where not exists (... is_standaardkantoor)" hieronder zorgen
-- ervoor dat een latere, bewuste wijziging (bv. een ANDER kantoor als standaard instellen, of een
-- domein aanpassen) bij een volgende toepassing van dit bestand NIET stilzwijgend teruggedraaid
-- wordt — exact hetzelfde voorzichtige patroon als de kantoor_id-backfill in onderdeel 6 hierboven.
update public.kantoren set email_domein = 'huyzen.be'
  where naam = 'Huyzen Vastgoed' and email_domein is null;
update public.kantoren set is_standaardkantoor = true
  where naam = 'Houpels Valuation & Real Estate'
    and not exists (select 1 from public.kantoren where is_standaardkantoor);

-- vervangt de hardcoded "@huyzen.be"-regel door een opzoeking in kantoren.email_domein — valt,
-- wanneer geen enkel kantoor dat domein claimt, terug op het kantoor met is_standaardkantoor = true
-- (en, als daar door een ongelukkige handmatige wijziging ooit geen enkele rij meer aan voldoet,
-- ter bescherming op de oorspronkelijke naam "Houpels Valuation & Real Estate" — zo kan een
-- registratie NOOIT stuklopen op een ontbrekend kantoor, want kantoor_id staat "not null").
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gekozen_kantoor uuid;
begin
  select id into gekozen_kantoor from public.kantoren
    where lower(email_domein) = split_part(lower(new.email), '@', 2);

  if gekozen_kantoor is null then
    select id into gekozen_kantoor from public.kantoren where is_standaardkantoor limit 1;
  end if;
  if gekozen_kantoor is null then
    select id into gekozen_kantoor from public.kantoren where naam = 'Houpels Valuation & Real Estate';
  end if;

  insert into public.profielen (id, naam, email, kantoor_id, voorwaarden_geaccepteerd_op)
  values (new.id, coalesce(new.raw_user_meta_data->>'naam', new.email), new.email, gekozen_kantoor, now());
  return new;
end;
$$;
