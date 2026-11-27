// ----------------------------------------------------------------------------
// data/fotoVerhuis.js — foto's van oudere dossiers in één keer naar Storage verhuizen
// ----------------------------------------------------------------------------
// Sinds november 2026 komen nieuwe foto's in Storage (zie data/fotoOpslag.js) en verhuizen die van
// een ouder dossier pas bij de volgende opslag. Dossiers die niemand meer opent, bleven zo met al
// hun foto's in de databank staan. Deze module doet die verhuis voor één dossier tegelijk, voor de
// knop "Foto's verhuizen" (schermen/FotoVerhuis.jsx, enkel voor beheerders):
//
//   1. de rij ophalen (media + data, voor de foto's van extra panden);
//   2. elke foto die nog als base64 in de databank staat, opladen naar Storage;
//   3. controleren dat elk bestand volledig in Storage staat (grootte per bestand) — een foto die
//      niet klopt, blijft in de databank;
//   4. enkel de foto-velden bijwerken, en enkel als de rij intussen niet gewijzigd werd. Het
//      merkteken "fotoVerhuis" laat "laatst bewerkt" staan (zie supabase/foto-verhuis.sql).
//
// De inhoud van het dossier verandert niet: bij het openen haalt de app de foto's gewoon weer op
// (haalFotosBinnen in data/dossiers.js) — fototabblad, rapport en PDF blijven identiek.
import { supabase } from "./supabase.js";
import { laadFotosOp, controleerOpgeladenFotos, zonderOpgeladenFotos, telFotosInDatabank } from "./fotoOpslag.js";

// een dossier dat minder dan een kwartier geleden bewerkt werd, staat misschien nog open bij
// iemand: dat slaan we (voorlopig) over
export const RECENT_MINUTEN = 15;

export async function verhuisFotosVanDossier(id, { nu = Date.now() } = {}) {
  const { data: rij, error } = await supabase.from("dossiers").select("id, laatst_bewerkt, media, data").eq("id", id).maybeSingle();
  if (error) return { id, status: "fout", reden: error.message };
  if (!rij) return { id, status: "overgeslagen", reden: "niet op de server (enkel lokaal)" };

  const media = rij.media && typeof rij.media === "object" ? rij.media : {};
  const data = rij.data && typeof rij.data === "object" ? rij.data : {};
  const dossier = { id, fotos: media.fotos || [], voorpaginaFoto: media.voorpaginaFoto || null, extraPanden: data.extraPanden || [] };
  const voor = telFotosInDatabank(dossier);
  if (!voor) return { id, status: "in orde", aantal: 0 };

  const bewerkt = rij.laatst_bewerkt ? new Date(rij.laatst_bewerkt).getTime() : 0;
  if (nu - bewerkt < RECENT_MINUTEN * 60 * 1000) {
    return { id, status: "overgeslagen", reden: `minder dan ${RECENT_MINUTEN} minuten geleden bewerkt — mogelijk nog open` };
  }

  await laadFotosOp(dossier);
  const controle = await controleerOpgeladenFotos(dossier);
  const nieuw = zonderOpgeladenFotos(dossier);
  const na = telFotosInDatabank(nieuw);
  const verhuisd = voor - na;
  if (!verhuisd) return { id, status: "fout", reden: "geen enkele foto kon veilig opgeladen worden", aantal: 0, afgekeurd: controle.afgekeurd };

  const payload = { media: { ...media, fotos: nieuw.fotos, voorpaginaFoto: nieuw.voorpaginaFoto, fotoVerhuis: true } };
  // de foto's van extra panden staan in de kolom data: die enkel meesturen als daar iets verhuisde
  if (telFotosInDatabank({ id, extraPanden: nieuw.extraPanden }) < telFotosInDatabank({ id, extraPanden: dossier.extraPanden })) {
    payload.data = { ...data, extraPanden: nieuw.extraPanden };
  }

  const { data: bijgewerkt, error: fout } = await supabase.from("dossiers").update(payload)
    .eq("id", id).eq("laatst_bewerkt", rij.laatst_bewerkt).select("laatst_bewerkt");
  if (fout) return { id, status: "fout", reden: fout.message };
  if (!bijgewerkt || !bijgewerkt.length) return { id, status: "overgeslagen", reden: "intussen gewijzigd — probeer later opnieuw" };
  // zonder supabase/foto-verhuis.sql springt "laatst bewerkt" toch naar nu: dan stopt de verhuis
  const datumBleef = new Date(bijgewerkt[0].laatst_bewerkt).getTime() === bewerkt;
  return {
    id, status: "verhuisd", aantal: verhuisd, nogInDatabank: na, afgekeurd: controle.afgekeurd,
    bytes: JSON.stringify(dossier).length - JSON.stringify(nieuw).length, datumBleef,
  };
}

// Alle dossiers na elkaar (nooit tegelijk: zo blijft de databank rustig). stop() onderbreekt na het
// lopende dossier; opnieuw starten slaat wat al verhuisd is vanzelf over ("in orde").
export function maakFotoVerhuis(ids, { opVoortgang = () => {}, verhuis = verhuisFotosVanDossier } = {}) {
  let gestopt = false;
  const resultaten = [];
  const start = async () => {
    for (let i = 0; i < ids.length; i++) {
      if (gestopt) break;
      let r;
      try {
        r = await verhuis(ids[i]);
      } catch (e) {
        r = { id: ids[i], status: "fout", reden: e && e.message ? e.message : String(e) };
      }
      resultaten.push(r);
      opVoortgang({ klaar: i + 1, totaal: ids.length, laatste: r, resultaten: [...resultaten] });
      // zonder de SQL-aanpassing zou elk dossier "laatst bewerkt: vandaag" krijgen: meteen stoppen
      if (r.status === "verhuisd" && r.datumBleef === false) { gestopt = true; break; }
    }
    return { resultaten, gestopt };
  };
  return { start, stop: () => { gestopt = true; } };
}

export function vatSamen(resultaten) {
  const tel = (s) => resultaten.filter((r) => r.status === s).length;
  return {
    verhuisd: tel("verhuisd"), inOrde: tel("in orde"), overgeslagen: tel("overgeslagen"), fout: tel("fout"),
    fotos: resultaten.reduce((s, r) => s + (r.aantal || 0), 0),
    mb: Math.round(resultaten.reduce((s, r) => s + (r.bytes || 0), 0) / 1048576),
    zonderSql: resultaten.some((r) => r.status === "verhuisd" && r.datumBleef === false),
  };
}
