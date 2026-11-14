-- ----------------------------------------------------------------------------
-- 10. KANTOOR PER E-MAILADRES (eenmanskantoren met een algemeen mailadres)
-- ----------------------------------------------------------------------------
-- Uitvoeren in: Supabase Dashboard > SQL Editor > "New query" > dit volledige blok plakken > Run.
-- Veilig om opnieuw uit te voeren (idempotent). Dit blok staat ook onderaan supabase/schema.sql.
--
-- Onderdeel 8 koppelt een nieuwe gebruiker aan een kantoor via het DOMEIN van het e-mailadres
-- (bv. @huyzen.be → Huyzen Vastgoed). Een zelfstandige schatter-expert met een eigen huisstijl
-- gebruikt vaak een algemeen adres (@icloud.com, @gmail.com, @skynet.be, ...): zo'n domein kan je
-- niet aan één kantoor koppelen. Daarom kan een kantoor voortaan ook een lijst EXACTE
-- e-mailadressen hebben. Bij een registratie gaat een exact adres vóór het domein, en het domein
-- vóór het standaardkantoor.
--
-- Enkel de platform-beheerder stelt dit in (Supabase Dashboard): de kolom staat bewust niet in de
-- kolomrechten van "authenticated" (zie onderdeel 7), dus een kantoor-beheerder kan er via de app
-- geen adressen van andere mensen aan toevoegen.

alter table public.kantoren add column if not exists email_adressen text[] not null default '{}';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gekozen_kantoor uuid;
begin
  -- 1. exact e-mailadres (hoofdletterongevoelig)
  select id into gekozen_kantoor from public.kantoren
    where exists (select 1 from unnest(email_adressen) a where lower(a) = lower(new.email))
    order by aangemaakt_op limit 1;
  -- 2. domein van het e-mailadres
  if gekozen_kantoor is null then
    select id into gekozen_kantoor from public.kantoren
      where lower(email_domein) = split_part(lower(new.email), '@', 2);
  end if;
  -- 3. standaardkantoor, en als vangnet het oorspronkelijke Houpels-kantoor
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
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon, authenticated;

-- Tim Audenaert: eigen huisstijl voor zijn account tim.audenaert@icloud.com (het kantoor zelf werd
-- op 13/11/2026 aangemaakt). Bestaat het account al, dan wordt het hier meteen mee verhuisd.
update public.kantoren set email_adressen = array['tim.audenaert@icloud.com']
  where naam = 'Tim Audenaert — Vlabel-erkend schatter-expert'
    and not ('tim.audenaert@icloud.com' = any(email_adressen));
update public.profielen p set kantoor_id = k.id
  from public.kantoren k
  where k.naam = 'Tim Audenaert — Vlabel-erkend schatter-expert'
    and lower(p.email) = 'tim.audenaert@icloud.com'
    and p.kantoor_id is distinct from k.id;
-- ... en zijn eventuele dossiers ook (die kregen bij het aanmaken het kantoor van dat moment)
update public.dossiers d set kantoor_id = k.id
  from public.kantoren k, public.profielen p
  where k.naam = 'Tim Audenaert — Vlabel-erkend schatter-expert'
    and lower(p.email) = 'tim.audenaert@icloud.com'
    and d.owner_id = p.id
    and d.kantoor_id is distinct from k.id;
