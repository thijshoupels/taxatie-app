-- ----------------------------------------------------------------------------
-- 10. KANTOOR PER E-MAILADRES + VENNOOTSCHAPSNAAM EN KBO-NUMMER PER KANTOOR
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
--
-- Daarnaast krijgt elk kantoor een vennootschapsnaam en een KBO-nummer. Die staan op het voorblad
-- van het verslag onder de kantoornaam (samen met het adres); een kantoor-beheerder vult ze in via
-- Kantoor-instellingen. Voorheen stonden ze enkel vast in de code, en enkel voor Houpels.

alter table public.kantoren add column if not exists email_adressen text[] not null default '{}';
alter table public.kantoren add column if not exists juridische_naam text not null default '';
alter table public.kantoren add column if not exists kbo text not null default '';
-- de kantoor-beheerder mag ze bijwerken (naast naam, kleur, logo, adres, telefoon en e-mail uit
-- onderdeel 7); email_adressen bewust niet
grant update (juridische_naam, kbo) on public.kantoren to authenticated;

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

-- Tim Audenaert (Audentra): eigen huisstijl voor zijn account tim.audenaert@icloud.com. Het kantoor
-- zelf, zijn account en zijn dossier werden op 16/11/2026 al naar dit kantoor verhuisd; dit zorgt
-- dat ook een volgende registratie of een nieuw account met dit adres er terechtkomt.
update public.kantoren set email_adressen = array['tim.audenaert@icloud.com']
  where id = '1549139e-1297-4745-bcec-25ba046cff46'
    and not ('tim.audenaert@icloud.com' = any(email_adressen));
update public.kantoren set juridische_naam = 'Audentra', kbo = '1028.139.622'
  where id = '1549139e-1297-4745-bcec-25ba046cff46' and juridische_naam = '' and kbo = '';
