-- ============================================================================
-- OPTIMALISATIE NOVEMBER 2026 — beveiliging en snelheid van de databank
-- ============================================================================
-- Uit te voeren in Supabase → SQL Editor → New query (alles plakken, Run). Mag meerdere keren
-- uitgevoerd worden. Voer eerst supabase/ai-verbruik.sql uit als de tabel ai_verbruik nog niet
-- bestaat (deze file past ze aan als ze er is, en slaat ze anders over).
--
-- Wat er verandert — voor de gebruikers van de app verandert er NIETS (getest met een matrix van
-- 27 acties × 5 soorten gebruikers: identieke uitkomst vóór en na):
--   1. Niet-aangemelde bezoekers (rol "anon") kunnen geen tabellen of controlefuncties meer
--      aanspreken. Voordien hield enkel de toegangsregel hen tegen; nu ook de rechten zelf.
--   2. De triggerfuncties (kantoor invullen bij een nieuw dossier/logregel) zijn niet langer
--      rechtstreeks aanroepbaar via de API — triggers werken zonder dat recht.
--   3. De toegangsregels gelden expliciet enkel voor aangemelde gebruikers, en lezen de
--      aangemelde gebruiker één keer per opvraging i.p.v. per rij ((select auth.uid())).
--   4. De controlefuncties zijn als STABLE gemarkeerd (zelfde uitkomst binnen één opvraging), zodat
--      Postgres ze kan hergebruiken.
--   5. Indexen op drie koppelingen (foreign keys) die er nog geen hadden.
-- ============================================================================

-- ---------- 1. rechten van niet-aangemelde bezoekers ----------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from public, anon;
-- ook voor tabellen/functies die later nog bijkomen
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from public, anon;

-- ---------- 2. triggerfuncties niet via de API ----------
revoke execute on function public.zet_kantoor_bij_nieuw_dossier() from authenticated;
revoke execute on function public.zet_kantoor_bij_nieuwe_gebeurtenis() from authenticated;
revoke execute on function public.set_laatst_bewerkt() from authenticated;

-- ---------- 4. controlefuncties: STABLE ----------
alter function public.eigen_kantoor(uuid) stable;
alter function public.is_beheerder() stable;
alter function public.mag_kantoor_beheren(uuid) stable;

-- ---------- 3. toegangsregels ----------
-- dossiers
alter policy "eigen dossiers of beheerder ziet alles" on public.dossiers to authenticated
  using (owner_id = (select auth.uid()) or public.mag_kantoor_beheren(kantoor_id) or public.heeft_dossier_toegang(id));
alter policy "ingelogde medewerkers maken dossiers aan" on public.dossiers to authenticated
  with check (owner_id = (select auth.uid()) or public.mag_kantoor_beheren(kantoor_id) or public.heeft_dossier_toegang(id));
alter policy "eigen dossiers bewerken of beheerder" on public.dossiers to authenticated
  using (owner_id = (select auth.uid()) or public.mag_kantoor_beheren(kantoor_id) or public.heeft_dossier_toegang(id))
  with check (owner_id = (select auth.uid()) or public.mag_kantoor_beheren(kantoor_id) or public.heeft_dossier_toegang(id));
alter policy "eigen dossiers verwijderen of beheerder" on public.dossiers to authenticated
  using (owner_id = (select auth.uid()) or public.mag_kantoor_beheren(kantoor_id));

-- dossierlogboek
alter policy "ingelogde gebruikers loggen eigen acties" on public.dossier_events to authenticated
  with check (gebruiker_id = (select auth.uid()));
alter policy "beheerder leest logboek" on public.dossier_events to authenticated
  using (public.mag_kantoor_beheren(kantoor_id));

-- delen
alter policy "toegang lezen" on public.dossier_toegang to authenticated
  using (gebruiker_id = (select auth.uid()) or public.mag_dossier_delen(dossier_id));
alter policy "dossier delen" on public.dossier_toegang to authenticated
  with check (gedeeld_door = (select auth.uid()) and public.mag_dossier_delen(dossier_id) and public.kan_dossier_krijgen(gebruiker_id, dossier_id));
alter policy "delen stoppen" on public.dossier_toegang to authenticated
  using (public.mag_dossier_delen(dossier_id) or gebruiker_id = (select auth.uid()));

-- profielen
alter policy "eigen profiel lezen" on public.profielen to authenticated
  using (id = (select auth.uid()) or public.mag_kantoor_beheren(kantoor_id));
alter policy "eigen profiel bewerken" on public.profielen to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- kantoren
alter policy "eigen kantoor lezen" on public.kantoren to authenticated
  using (public.eigen_kantoor(id) or public.mag_kantoor_beheren(id));
alter policy "kantoor-beheerder werkt huisstijl bij" on public.kantoren to authenticated
  using (public.mag_kantoor_beheren(id))
  with check (public.mag_kantoor_beheren(id));

-- persoonlijke voorkeuren
alter policy "eigen voorkeuren lezen" on public.profiel_voorkeuren using (user_id = (select auth.uid()));
alter policy "eigen voorkeuren aanmaken" on public.profiel_voorkeuren with check (user_id = (select auth.uid()));
alter policy "eigen voorkeuren wijzigen" on public.profiel_voorkeuren
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "eigen voorkeuren verwijderen" on public.profiel_voorkeuren using (user_id = (select auth.uid()));

-- AI-verbruik (enkel als supabase/ai-verbruik.sql al uitgevoerd werd)
do $$
begin
  if to_regclass('public.ai_verbruik') is not null then
    execute $p$alter policy "ingelogde gebruikers loggen eigen ai-verbruik" on public.ai_verbruik to authenticated
      with check (gebruiker_id = (select auth.uid()))$p$;
    execute $p$alter policy "eigen ai-verbruik of beheerder leest" on public.ai_verbruik to authenticated
      using (gebruiker_id = (select auth.uid()) or public.mag_kantoor_beheren(kantoor_id))$p$;
  end if;
end $$;

-- ---------- 5. indexen op koppelingen ----------
create index if not exists dossier_events_gebruiker_idx on public.dossier_events (gebruiker_id);
create index if not exists dossier_events_kantoor_idx on public.dossier_events (kantoor_id);
create index if not exists dossier_toegang_gedeeld_door_idx on public.dossier_toegang (gedeeld_door);
