-- ----------------------------------------------------------------------------
-- 11. PERSOONLIJKE VOORKEUREN: STANDAARDWAARDEN EN BEWAARDE HANDTEKENING
-- ----------------------------------------------------------------------------
-- Uitvoeren in: Supabase Dashboard > SQL Editor > "New query" > dit volledige blok plakken > Run.
-- Veilig om opnieuw uit te voeren (idempotent). Dit blok staat ook onderaan supabase/schema.sql.
--
-- Per gebruiker één rij met:
--   - standaarden: de waarden waarmee een NIEUW dossier start (bv. gedwongen verkoopfactor 0,80,
--     yield 2,5 - 3,5 %, transactiekosten 14 %) — zie src/domein/standaarden.js;
--   - handtekening: de getekende handtekening (PNG als base64), zodat ze met één klik in een
--     verslag geplaatst kan worden in plaats van telkens opnieuw te tekenen.
--
-- Bewust een APARTE tabel (en niet extra kolommen in "profielen"): profielen zijn leesbaar voor
-- kantoorgenoten en beheerders (namen, delen, ...). Een handtekening hoort enkel bij de gebruiker
-- zelf: hier kan ENKEL de eigenaar zijn eigen rij lezen of wijzigen — ook een beheerder niet.

create table if not exists public.profiel_voorkeuren (
  user_id uuid primary key references auth.users(id) on delete cascade,
  standaarden jsonb not null default '{}'::jsonb,
  handtekening text not null default '',
  bijgewerkt_op timestamptz not null default now()
);

-- begrenzing: een handtekening is een kleine PNG, de standaarden een handvol waarden
alter table public.profiel_voorkeuren drop constraint if exists profiel_voorkeuren_handtekening_grootte;
alter table public.profiel_voorkeuren add constraint profiel_voorkeuren_handtekening_grootte
  check (length(handtekening) <= 400000 and (handtekening = '' or handtekening like 'data:image/png;base64,%'));
alter table public.profiel_voorkeuren drop constraint if exists profiel_voorkeuren_standaarden_vorm;
alter table public.profiel_voorkeuren add constraint profiel_voorkeuren_standaarden_vorm
  check (jsonb_typeof(standaarden) = 'object' and pg_column_size(standaarden) <= 8000);

alter table public.profiel_voorkeuren enable row level security;

drop policy if exists "eigen voorkeuren lezen" on public.profiel_voorkeuren;
create policy "eigen voorkeuren lezen" on public.profiel_voorkeuren
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "eigen voorkeuren aanmaken" on public.profiel_voorkeuren;
create policy "eigen voorkeuren aanmaken" on public.profiel_voorkeuren
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "eigen voorkeuren wijzigen" on public.profiel_voorkeuren;
create policy "eigen voorkeuren wijzigen" on public.profiel_voorkeuren
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "eigen voorkeuren verwijderen" on public.profiel_voorkeuren;
create policy "eigen voorkeuren verwijderen" on public.profiel_voorkeuren
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.profiel_voorkeuren from anon;
grant select, insert, update, delete on public.profiel_voorkeuren to authenticated;
