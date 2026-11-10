// ----------------------------------------------------------------------------
// schermen/DelenVenster.jsx — een dossier delen met collega's van hetzelfde kantoor
// ----------------------------------------------------------------------------
// Geopend vanuit het dossieroverzicht (Dashboard.jsx) door de eigenaar of een beheerder. Toont de
// collega's van het kantoor van het dossier met een vinkje: aanvinken = delen, uitvinken = stoppen.
// Elke klik wordt meteen opgeslagen (geen aparte "Bewaren"-knop). Wie een dossier gedeeld krijgt,
// mag het bekijken en bewerken, maar niet verwijderen of verder delen — zie
// supabase/delen-met-collegas.sql.
import React, { useEffect, useState } from "react";
import { X, Users } from "lucide-react";
import { INK, INK_SOFT, PAPER, PAPER_RAISED, LINE, ACCENT, DANGER, SANS } from "../constants.js";
import { haalKantoorgenoten } from "../data/delen.js";

export function DelenVenster({ dossier, onToggle, onClose }) {
  const [collegas, setCollegas] = useState(null); // null = laden
  const [fout, setFout] = useState("");
  const [bezig, setBezig] = useState(""); // id van de collega waarvoor een klik loopt
  const gedeeldMet = dossier.gedeeldMet || [];
  const adres = dossier.straat ? `${dossier.straat} ${dossier.nummer}${dossier.bus ? "/" + dossier.bus : ""}` : "Naamloos dossier";

  useEffect(() => {
    let actief = true;
    haalKantoorgenoten(dossier.kantoorId).then((r) => {
      if (!actief) return;
      if (!r.ok) { setFout(r.error); setCollegas([]); return; }
      // de eigenaar zelf staat niet in de lijst: die heeft het dossier al
      setCollegas(r.collegas.filter((c) => c.id !== dossier.ownerId));
    });
    return () => { actief = false; };
  }, [dossier.id, dossier.kantoorId, dossier.ownerId]);

  const klik = async (collega) => {
    if (bezig) return;
    setBezig(collega.id);
    setFout("");
    const res = await onToggle(dossier.id, collega.id, !gedeeldMet.includes(collega.id));
    if (res && res.ok === false) setFout(res.error || "Delen mislukt.");
    setBezig("");
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1000 }}
      onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="delen-titel" className="rounded-xl p-6 overflow-y-auto"
        style={{ width: 460, maxWidth: "100%", maxHeight: "85vh", background: PAPER_RAISED, border: `1px solid ${LINE}` }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <div id="delen-titel" className="flex items-center gap-2" style={{ fontFamily: SANS, fontSize: 18, fontWeight: 500, color: INK }}>
            <Users size={17} style={{ color: ACCENT }} /> Delen met collega's
          </div>
          <button onClick={onClose} aria-label="Sluiten"><X size={18} style={{ color: INK_SOFT }} /></button>
        </div>
        <div className="text-sm mb-1" style={{ color: INK }}>{adres}</div>
        <div className="text-xs mb-4" style={{ color: INK_SOFT, lineHeight: 1.6 }}>
          Collega's die je aanvinkt, zien dit dossier in hun overzicht en kunnen het mee invullen, ook de foto's,
          documenten en het verslag. Verwijderen en verder delen kunnen ze niet. Werken twee mensen tegelijk in het
          dossier, dan krijgt wie als tweede opslaat een melding in plaats van het werk van de ander te overschrijven.
        </div>

        {collegas === null ? (
          <div className="text-sm italic" style={{ color: INK_SOFT }}>Collega's laden...</div>
        ) : collegas.length === 0 && !fout ? (
          <div className="text-sm italic" style={{ color: INK_SOFT }}>Er zijn geen andere collega's bij dit kantoor.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {collegas.map((c) => {
              const aan = gedeeldMet.includes(c.id);
              return (
                <label key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer"
                  style={{ border: `1px solid ${LINE}`, background: PAPER, opacity: bezig && bezig !== c.id ? 0.6 : 1 }}>
                  <input type="checkbox" checked={aan} disabled={!!bezig} onChange={() => klik(c)} />
                  <span className="text-sm" style={{ color: INK, flex: 1 }}>{c.naam || "Naamloze collega"}</span>
                  {bezig === c.id && <span className="text-xs" style={{ color: INK_SOFT }}>bewaren...</span>}
                  {aan && bezig !== c.id && <span className="text-xs" style={{ color: ACCENT, fontWeight: 500 }}>gedeeld</span>}
                </label>
              );
            })}
          </div>
        )}

        {fout && <div className="text-xs mt-3" role="alert" style={{ color: DANGER, lineHeight: 1.5 }}>{fout}</div>}

        <button onClick={onClose} className="w-full text-sm py-2 rounded-lg mt-5" style={{ background: INK, color: PAPER, fontWeight: 500 }}>
          Klaar
        </button>
      </div>
    </div>
  );
}
