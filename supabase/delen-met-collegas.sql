-- ----------------------------------------------------------------------------
-- 9. DOSSIERS DELEN MET COLLEGA'S (meerdere mensen op één dossier)
-- ----------------------------------------------------------------------------
-- Uitvoeren in: Supabase Dashboard > SQL Editor > "New query" > dit volledige blok plakken > Run.
-- Veilig om opnieuw uit te voeren (idempotent). Dit blok staat ook onderaan supabase/schema.sql.
--
-- Tot hier had elk dossier precies één eigenaar (owner_id): enkel die eigenaar en de beheerders
-- van het kantoor zagen en bewerkten het. Dit onderdeel laat de eigenaar (of een beheerder) een
-- dossier delen met collega's van HETZELFDE kantoor. Wie een dossier gedeeld krijgt, mag het
-- bekijken en bewerken (incl. foto's en documenten), maar niet verwijderen en niet verder delen.
-- Twee mensen die tegelijk in hetzelfde dossier werken, overschrijven elkaar niet: de bestaande
-- botsingscontrole bij het opslaan (zie _saveDossierPoging in src/data/dossiers.js) weigert dan
-- de tweede opslagbeurt met een melding.

create table if not exists public.dossier_toegang (
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  gebruiker_id uuid not null references auth.users(id) on delete cascade,
  gedeeld_door uuid references auth.users(id) on delete set null,
  gedeeld_op timestamptz not null default now(),
  primary key (dossier_id, gebruiker_id)
);
create index if not exists dossier_toegang_gebruiker_idx on public.dossier_toegang (gebruiker_id);

alter table public.dossier_toegang enable row level security;

-- Heeft de ingelogde gebruiker dit dossier gedeeld gekregen? Enkel zolang die gebruiker bij
-- hetzelfde kantoor hoort als het dossier: verhuist iemand naar een ander kantoor, dan vervalt de
-- toegang vanzelf, ook als de rij in dossier_toegang nog bestaat. "security definer" om dezelfde
-- reden als bij mag_kantoor_beheren hierboven (de functie moet de tabellen kunnen lezen ongeacht
-- hun eigen rijregels — anders zou de regel op "dossiers" zichzelf aanroepen).
create or replace function public.heeft_dossier_toegang(doel_dossier uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.dossier_toegang t
    join public.dossiers d on d.id = t.dossier_id
    join public.profielen p on p.id = t.gebruiker_id
    where t.dossier_id = doel_dossier
      and t.gebruiker_id = auth.uid()
      and p.kantoor_id = d.kantoor_id
  );
$$;

-- Mag de ingelogde gebruiker dit dossier delen (of het delen stoppen)? De eigenaar, of een
-- beheerder van het kantoor van het dossier (of de platform-beheerder). Een collega met wie het
-- dossier gedeeld is, mag het NIET verder delen.
create or replace function public.mag_dossier_delen(doel_dossier uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.dossiers d
    where d.id = doel_dossier
      and (d.owner_id = auth.uid() or public.mag_kantoor_beheren(d.kantoor_id))
  );
$$;

-- Kan dit dossier met deze persoon gedeeld worden? Enkel met iemand van hetzelfde kantoor als het
-- dossier, en niet met de eigenaar zelf (die heeft al toegang).
create or replace function public.kan_dossier_krijgen(doel_gebruiker uuid, doel_dossier uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.dossiers d
    join public.profielen p on p.kantoor_id = d.kantoor_id
    where d.id = doel_dossier
      and p.id = doel_gebruiker
      and p.id is distinct from d.owner_id
  );
$$;

-- De collega's (id + naam) van een kantoor, om in de app een keuzelijst te tonen en de naam van
-- de eigenaar van een gedeeld dossier te kunnen vermelden. De profielen-tabel zelf blijft
-- afgeschermd (telefoon, BIV- en Vlabel-nummer): deze functie geeft enkel id en naam, en enkel van
-- het EIGEN kantoor (of van een kantoor dat de aanvrager beheert). Zonder argument: het eigen kantoor.
create or replace function public.kantoorgenoten(doel_kantoor uuid default null)
returns table (id uuid, naam text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.naam
  from public.profielen p
  where p.kantoor_id = coalesce(doel_kantoor, (select kantoor_id from public.profielen where id = auth.uid()))
    and (public.eigen_kantoor(p.kantoor_id) or public.mag_kantoor_beheren(p.kantoor_id))
  order by p.naam;
$$;

revoke execute on function public.kantoorgenoten(uuid) from public, anon;
grant execute on function public.kantoorgenoten(uuid) to authenticated;
-- de drie hulpfuncties hierboven worden binnen toegangsregels opgeroepen en moeten dus, net als
-- is_beheerder() (zie de toelichting in onderdeel 4), uitvoerbaar blijven voor "authenticated";
-- enkel "anon" (niet ingelogd) heeft er niets aan
revoke execute on function public.heeft_dossier_toegang(uuid) from public, anon;
revoke execute on function public.mag_dossier_delen(uuid) from public, anon;
revoke execute on function public.kan_dossier_krijgen(uuid, uuid) from public, anon;
grant execute on function public.heeft_dossier_toegang(uuid) to authenticated;
grant execute on function public.mag_dossier_delen(uuid) to authenticated;
grant execute on function public.kan_dossier_krijgen(uuid, uuid) to authenticated;

-- toegangsregels op dossier_toegang zelf
drop policy if exists "toegang lezen" on public.dossier_toegang;
create policy "toegang lezen"
  on public.dossier_toegang for select
  using (gebruiker_id = auth.uid() or public.mag_dossier_delen(dossier_id));

drop policy if exists "dossier delen" on public.dossier_toegang;
create policy "dossier delen"
  on public.dossier_toegang for insert
  with check (
    auth.role() = 'authenticated'
    and gedeeld_door = auth.uid()
    and public.mag_dossier_delen(dossier_id)
    and public.kan_dossier_krijgen(gebruiker_id, dossier_id)
  );

-- stoppen met delen: de eigenaar/beheerder, of de collega zelf (die zich uit het dossier haalt)
drop policy if exists "delen stoppen" on public.dossier_toegang;
create policy "delen stoppen"
  on public.dossier_toegang for delete
  using (public.mag_dossier_delen(dossier_id) or gebruiker_id = auth.uid());

-- geen update-regel: een deelregel wordt enkel toegevoegd of verwijderd, nooit aangepast
revoke update on table public.dossier_toegang from authenticated, anon;

-- de dossier-toegangsregels uit onderdeel 6, uitgebreid met "of gedeeld met mij". Verwijderen
-- blijft voorbehouden aan de eigenaar en de beheerders.
-- (De insert-regel krijgt dezelfde uitbreiding om dezelfde reden als in onderdeel 3: opslaan
-- gebeurt soms via een upsert, en Postgres past daarbij altijd eerst de insert-regel toe.)
drop policy if exists "eigen dossiers of beheerder ziet alles" on public.dossiers;
create policy "eigen dossiers of beheerder ziet alles"
  on public.dossiers for select
  using (owner_id = auth.uid() or public.mag_kantoor_beheren(kantoor_id) or public.heeft_dossier_toegang(id));

drop policy if exists "ingelogde medewerkers maken dossiers aan" on public.dossiers;
create policy "ingelogde medewerkers maken dossiers aan"
  on public.dossiers for insert
  with check (auth.role() = 'authenticated' and (owner_id = auth.uid() or public.mag_kantoor_beheren(kantoor_id) or public.heeft_dossier_toegang(id)));

drop policy if exists "eigen dossiers bewerken of beheerder" on public.dossiers;
create policy "eigen dossiers bewerken of beheerder"
  on public.dossiers for update
  using (owner_id = auth.uid() or public.mag_kantoor_beheren(kantoor_id) or public.heeft_dossier_toegang(id))
  with check (owner_id = auth.uid() or public.mag_kantoor_beheren(kantoor_id) or public.heeft_dossier_toegang(id));

-- Een collega met bewerkrecht mag NIET zichzelf eigenaar maken (owner_id staat open in de
-- kolomrechten van onderdeel 6, omdat de app die kolom bij elke opslag meestuurt). Enkel de
-- eigenaar zelf of een beheerder mag de eigenaar wijzigen. Rechtstreeks in het Supabase Dashboard
-- (SQL Editor / Table Editor, geen ingelogde app-gebruiker: auth.uid() is dan leeg) blijft dit
-- mogelijk, zodat je een dossier van een vertrekkende collega kan overdragen.
create or replace function public.bewaak_eigenaar_dossier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is distinct from old.owner_id
     and auth.uid() is not null
     and not (old.owner_id = auth.uid() or public.mag_kantoor_beheren(old.kantoor_id)) then
    raise exception 'Enkel de eigenaar of een beheerder kan de eigenaar van een dossier wijzigen';
  end if;
  return new;
end;
$$;
revoke execute on function public.bewaak_eigenaar_dossier() from public, anon, authenticated;

drop trigger if exists dossiers_bewaak_eigenaar_trigger on public.dossiers;
create trigger dossiers_bewaak_eigenaar_trigger
  before update on public.dossiers
  for each row execute procedure public.bewaak_eigenaar_dossier();

-- foto's en documenten: dezelfde uitbreiding voor de vier bijlage-regels
drop policy if exists "medewerkers lezen bijlagen" on storage.objects;
create policy "medewerkers lezen bijlagen"
  on storage.objects for select
  using (
    bucket_id = 'dossier-bijlagen'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.dossiers d
      where d.id::text = (storage.foldername(name))[1]
        and (d.owner_id = auth.uid() or public.mag_kantoor_beheren(d.kantoor_id) or public.heeft_dossier_toegang(d.id))
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
        and (d.owner_id = auth.uid() or public.mag_kantoor_beheren(d.kantoor_id) or public.heeft_dossier_toegang(d.id))
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
        and (d.owner_id = auth.uid() or public.mag_kantoor_beheren(d.kantoor_id) or public.heeft_dossier_toegang(d.id))
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
        and (d.owner_id = auth.uid() or public.mag_kantoor_beheren(d.kantoor_id) or public.heeft_dossier_toegang(d.id))
    )
  )
  with check (
    bucket_id = 'dossier-bijlagen'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.dossiers d
      where d.id::text = (storage.foldername(name))[1]
        and (d.owner_id = auth.uid() or public.mag_kantoor_beheren(d.kantoor_id) or public.heeft_dossier_toegang(d.id))
    )
  );

-- logboek: drie nieuwe soorten gebeurtenissen (delen, delen stoppen, een collega opent een
-- gedeeld dossier) — de bestaande vier blijven ongewijzigd toegelaten
alter table public.dossier_events drop constraint if exists dossier_events_actie_check;
alter table public.dossier_events add constraint dossier_events_actie_check
  check (actie in ('aangemaakt', 'gewijzigd', 'verwijderd', 'geopend_door_beheerder', 'gedeeld', 'delen_gestopt', 'geopend_door_collega'));
