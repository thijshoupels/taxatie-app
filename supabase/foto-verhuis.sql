-- ============================================================================
-- FOTO'S VERHUIZEN — "laatst bewerkt" blijft staan
-- ============================================================================
-- Uit te voeren in Supabase → SQL Editor → New query (alles plakken, Run), vóór je de knop
-- "Foto's verhuizen" in de app gebruikt. Mag meerdere keren uitgevoerd worden.
--
-- De knop "Foto's verhuizen" (src/data/fotoVerhuis.js) zet de foto's van oudere dossiers uit de
-- databank naar de opslag (bucket "dossier-bijlagen"). De inhoud van het dossier verandert daarbij
-- niet: elke foto staat er nog, enkel op een andere plaats. Zonder deze aanpassing zou elk verhuisd
-- dossier toch "laatst bewerkt: vandaag" krijgen en bovenaan het overzicht springen.
--
-- Hoe: de app stuurt bij een verhuis het merkteken "fotoVerhuis" mee in de kolom media. Staat dat
-- merkteken er, dan haalt deze trigger het weer weg en laat ze laatst_bewerkt ongewijzigd. Elke
-- gewone opslag (zonder merkteken) zet laatst_bewerkt zoals altijd op nu.
-- ============================================================================

create or replace function public.set_laatst_bewerkt()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.media is not null and jsonb_typeof(new.media) = 'object' and new.media ? 'fotoVerhuis' then
    new.media = new.media - 'fotoVerhuis';
    new.laatst_bewerkt = old.laatst_bewerkt;
    return new;
  end if;
  new.laatst_bewerkt = now();
  return new;
end;
$$;

-- triggerfunctie: niet rechtstreeks aanroepbaar via de API (zie optimalisatie-2026-11.sql)
revoke execute on function public.set_laatst_bewerkt() from public, anon, authenticated;
