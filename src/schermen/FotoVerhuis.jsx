// ----------------------------------------------------------------------------
// schermen/FotoVerhuis.jsx — "Foto's verhuizen" (enkel voor beheerders)
// ----------------------------------------------------------------------------
// Verhuist de foto's van oudere dossiers uit de databank naar Storage (zie data/fotoVerhuis.js).
// Eerst een proefloop op één dossier dat de beheerder zelf kiest en nakijkt; pas daarna kan hij
// alle dossiers laten verhuizen. Eén dossier tegelijk, met een stopknop; opnieuw starten slaat
// wat al verhuisd is vanzelf over.
import React, { useMemo, useRef, useState } from "react";
import { X, ImageUp, Check, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import { INK, INK_SOFT, LINE, PAPER, PAPER_RAISED, ACCENT, ACCENT_SOFT, STAMP, DANGER, SANS } from "../constants.js";
import { verhuisFotosVanDossier, maakFotoVerhuis, vatSamen } from "../data/fotoVerhuis.js";

const adresVan = (x) => [[x.straat, x.nummer].filter(Boolean).join(" "), x.gemeente].filter(Boolean).join(", ") || "Dossier zonder adres";

const STATUS_TEKST = {
  verhuisd: (r) => `${r.aantal} foto${r.aantal === 1 ? "" : "'s"} verhuisd${r.nogInDatabank ? `, ${r.nogInDatabank} bleven in de databank` : ""}`,
  "in orde": () => "al in orde — geen foto's meer in de databank",
  overgeslagen: (r) => `overgeslagen: ${r.reden}`,
  fout: (r) => `niet gelukt: ${r.reden}`,
};
// de proefloop blijft onthouden zolang de pagina open is: je opent het dossier om het na te kijken
// (en verlaat daarbij dit venster), daarna kom je terug voor stap 2
let _proefOnthouden = { id: "", resultaat: null, nagekeken: false };

const kleurVoor = (s) => (s === "verhuisd" || s === "in orde" ? STAMP : s === "fout" ? DANGER : ACCENT);

export function FotoVerhuis({ index, onSluit, onOpen }) {
  const dossiers = useMemo(() => (index || []).filter((x) => x && x.id && !x.lokaal), [index]);
  const [proefId, setProefIdState] = useState(_proefOnthouden.id);
  const [proef, setProefState] = useState(_proefOnthouden.resultaat); // resultaat van de proefloop
  const [proefBezig, setProefBezig] = useState(false);
  const [nagekeken, setNagekekenState] = useState(_proefOnthouden.nagekeken);
  const setProefId = (v) => { _proefOnthouden.id = v; setProefIdState(v); };
  const setProef = (v) => { _proefOnthouden.resultaat = v; setProefState(v); };
  const setNagekeken = (v) => { _proefOnthouden.nagekeken = v; setNagekekenState(v); };
  const [voortgang, setVoortgang] = useState(null); // { klaar, totaal, resultaten }
  const [bezig, setBezig] = useState(false);
  const [einde, setEinde] = useState(null);
  const lopend = useRef(null);
  const adres = (id) => adresVan(dossiers.find((x) => x.id === id) || {});

  const doeProef = async () => {
    if (!proefId) return;
    setProefBezig(true); setProef(null); setNagekeken(false);
    try {
      setProef(await verhuisFotosVanDossier(proefId));
    } catch (e) {
      setProef({ id: proefId, status: "fout", reden: e.message });
    } finally {
      setProefBezig(false);
    }
  };

  const doeAlles = async () => {
    setBezig(true); setEinde(null);
    setVoortgang({ klaar: 0, totaal: dossiers.length, resultaten: [] });
    const verhuis = maakFotoVerhuis(dossiers.map((x) => x.id), { opVoortgang: setVoortgang });
    lopend.current = verhuis;
    const uit = await verhuis.start();
    lopend.current = null;
    setBezig(false);
    setEinde(uit);
  };

  const proefOk = proef && (proef.status === "verhuisd" || proef.status === "in orde");
  const zonderSql = proef && proef.status === "verhuisd" && proef.datumBleef === false;
  const samen = voortgang ? vatSamen(voortgang.resultaten) : null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="fotoverhuis-titel" className="fixed inset-0 z-50 flex items-start justify-center overflow-auto p-4"
      style={{ background: "rgba(20,22,24,.45)" }}>
      <div className="w-full rounded-xl p-5 md:p-6 my-6" style={{ maxWidth: 720, background: PAPER, color: INK, boxShadow: "0 10px 40px rgba(0,0,0,.25)" }}>
        <div className="flex items-center gap-2 mb-2">
          <ImageUp size={17} style={{ color: ACCENT }} />
          <h2 id="fotoverhuis-titel" style={{ fontFamily: SANS, fontSize: 18, fontWeight: 600 }}>Foto's verhuizen</h2>
          <button type="button" onClick={onSluit} disabled={bezig} aria-label="Sluiten" className="p-1 rounded" style={{ color: INK_SOFT, marginLeft: "auto" }}><X size={16} /></button>
        </div>
        <p className="text-sm" style={{ color: INK_SOFT }}>
          Oudere dossiers hebben hun foto's nog in de databank. Dat maakt die zwaar en traag. Deze knop zet ze in de beveiligde opslag,
          bij de documenten. In het dossier verandert niets: bij het openen haalt de app de foto's gewoon op, en het rapport en de PDF
          blijven identiek. Elke foto wordt na het opladen gecontroleerd; een foto die niet volledig in de opslag staat, blijft in de databank.
        </p>
        <p className="text-xs mt-2 px-3 py-2 rounded" style={{ background: ACCENT_SOFT, color: INK }}>
          Voer eerst <strong>supabase/foto-verhuis.sql</strong> uit in Supabase (SQL Editor). Daardoor blijft "laatst bewerkt" van elk dossier staan.
        </p>

        {/* stap 1: proefloop */}
        <div className="mt-5 rounded-lg p-4" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
          <div className="text-sm" style={{ fontWeight: 600 }}>1. Proefloop op één dossier</div>
          <div className="text-xs mt-1 mb-3" style={{ color: INK_SOFT }}>Kies een dossier met foto's, verhuis het, open het en kijk het fototabblad en het rapport na.</div>
          <div className="flex flex-wrap gap-2">
            <select value={proefId} onChange={(e) => { setProefId(e.target.value); setProef(null); setNagekeken(false); }} disabled={proefBezig || bezig}
              className="flex-1 text-sm px-2 py-2 rounded" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED, color: INK, minWidth: 220 }}>
              <option value="">— kies een dossier —</option>
              {dossiers.map((x) => <option key={x.id} value={x.id}>{adresVan(x)}{x.status === "afgewerkt" ? " (afgewerkt)" : ""}</option>)}
            </select>
            <button type="button" onClick={doeProef} disabled={!proefId || proefBezig || bezig}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg"
              style={{ background: proefId && !proefBezig && !bezig ? INK : "var(--ink-faint)", color: PAPER, fontWeight: 500 }}>
              {proefBezig ? <Loader2 size={14} className="animate-spin" /> : <ImageUp size={14} />} Verhuis dit dossier
            </button>
          </div>
          {proef && (
            <div className="mt-3 text-sm" style={{ color: kleurVoor(proef.status) }}>
              {proef.status === "verhuisd" || proef.status === "in orde" ? <Check size={14} className="inline mr-1" /> : <AlertTriangle size={14} className="inline mr-1" />}
              {adres(proef.id)}: {STATUS_TEKST[proef.status](proef)}
            </div>
          )}
          {zonderSql && (
            <div className="mt-2 text-xs px-3 py-2 rounded" style={{ background: "#FBEAEA", color: DANGER }}>
              De foto's zijn verhuisd, maar "laatst bewerkt" van dit dossier sprong naar vandaag: supabase/foto-verhuis.sql is nog niet uitgevoerd.
              Voer die eerst uit voor je alle dossiers verhuist.
            </div>
          )}
          {proefOk && !zonderSql && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => onOpen(proef.id)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                style={{ border: `1px solid ${LINE}`, color: INK, fontWeight: 500 }}>
                <ExternalLink size={13} /> Dossier openen om na te kijken
              </button>
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: INK }}>
                <input type="checkbox" checked={nagekeken} onChange={(e) => setNagekeken(e.target.checked)} />
                Ik heb de foto's en het rapport nagekeken: alles staat er
              </label>
            </div>
          )}
        </div>

        {/* stap 2: alle dossiers */}
        <div className="mt-4 rounded-lg p-4" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED, opacity: nagekeken || voortgang ? 1 : 0.6 }}>
          <div className="text-sm" style={{ fontWeight: 600 }}>2. Alle dossiers ({dossiers.length})</div>
          <div className="text-xs mt-1 mb-3" style={{ color: INK_SOFT }}>
            Eén dossier tegelijk. Je kunt stoppen en later opnieuw starten: wat al verhuisd is, wordt overgeslagen. Dossiers die net bewerkt
            werden, worden overgeslagen; die verhuizen bij een volgende poging of bij hun volgende opslag.
          </div>
          <div className="flex flex-wrap gap-2">
            {!bezig ? (
              <button type="button" onClick={doeAlles} disabled={!nagekeken}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg"
                style={{ background: nagekeken ? INK : "var(--ink-faint)", color: PAPER, fontWeight: 500, cursor: nagekeken ? "pointer" : "not-allowed" }}>
                <ImageUp size={14} /> {einde ? "Opnieuw starten" : "Alle dossiers verhuizen"}
              </button>
            ) : (
              <button type="button" onClick={() => lopend.current && lopend.current.stop()}
                className="text-sm px-3 py-2 rounded-lg" style={{ border: `1px solid ${DANGER}`, color: DANGER, fontWeight: 500 }}>
                Stoppen na dit dossier
              </button>
            )}
            {!nagekeken && !voortgang && <span className="text-xs self-center" style={{ color: INK_SOFT }}>Eerst de proefloop nakijken.</span>}
          </div>

          {voortgang && (
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1" style={{ color: INK_SOFT }}>
                <span>{bezig ? "Bezig…" : einde && einde.gestopt ? "Gestopt" : "Klaar"} — {voortgang.klaar} van {voortgang.totaal}</span>
                {samen && <span>{samen.fotos} foto's · ± {samen.mb} MB uit de databank</span>}
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 6, background: LINE }}>
                <div style={{ width: `${voortgang.totaal ? (voortgang.klaar / voortgang.totaal) * 100 : 0}%`, height: "100%", background: STAMP, transition: "width .2s" }} />
              </div>
              {samen && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-2">
                  <span style={{ color: STAMP }}>Verhuisd: {samen.verhuisd}</span>
                  <span style={{ color: STAMP }}>Al in orde: {samen.inOrde}</span>
                  <span style={{ color: ACCENT }}>Overgeslagen: {samen.overgeslagen}</span>
                  <span style={{ color: samen.fout ? DANGER : INK_SOFT }}>Niet gelukt: {samen.fout}</span>
                </div>
              )}
              {samen && samen.zonderSql && (
                <div className="mt-2 text-xs px-3 py-2 rounded" style={{ background: "#FBEAEA", color: DANGER }}>
                  Gestopt: "laatst bewerkt" sprong naar vandaag. Voer eerst supabase/foto-verhuis.sql uit en start daarna opnieuw.
                </div>
              )}
              <ul className="mt-3 text-xs max-h-48 overflow-auto" style={{ color: INK_SOFT }}>
                {voortgang.resultaten.filter((r) => r.status !== "in orde").slice(-50).reverse().map((r) => (
                  <li key={r.id} className="py-0.5"><span style={{ color: kleurVoor(r.status) }}>●</span> {adres(r.id)}: {STATUS_TEKST[r.status](r)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
