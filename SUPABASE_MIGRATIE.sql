-- Eenmalige migratie voor de autosave-optimalisatie (foto's/documenten enkel
-- meesturen bij effectieve wijziging, i.p.v. bij elke tekstinvoer).
--
-- Wat: voegt een nieuwe, aparte kolom "media" toe aan de "dossiers"-tabel,
-- los van de bestaande "data"-kolom. Foto's, documenten en de voorpagina-foto
-- (samen meestal het merendeel van de databytes van een dossier) worden
-- voortaan in die aparte kolom bewaard, zodat een upsert die enkel een
-- gewoon tekstveld wijzigt de "media"-kolom niet meer moet meesturen.
--
-- Risico: minimaal. Dit voegt enkel een nieuwe, nullable kolom toe — er
-- wordt niets verwijderd of overschreven, en bestaande dossiers/rijen
-- blijven perfect leesbaar (de app valt voor hen automatisch terug op de
-- oude locatie in "data" zolang "media" voor dat dossier leeg is).
--
-- Hoe uit te voeren: Supabase-dashboard → jouw project → SQL Editor →
-- plak onderstaande regel → Run.

alter table public.dossiers add column if not exists media jsonb;

-- Dat is alles. Er is geen backfill nodig: bestaande dossiers blijven
-- gewoon werken (fotos/documenten staan nog in "data"), en beginnen pas
-- met de "media"-kolom te gebruiken zodra ze na deze migratie opnieuw
-- worden opgeslagen vanuit de app.
