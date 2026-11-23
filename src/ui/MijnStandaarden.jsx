// ----------------------------------------------------------------------------
// ui/MijnStandaarden.jsx — "Mijn standaarden" en "Mijn handtekening" (scherm Mijn account)
// ----------------------------------------------------------------------------
// De waarden waarmee een NIEUW dossier start (zie domein/standaarden.js) en de bewaarde
// handtekening (zie data/voorkeuren.js). Een leeg veld = de algemene standaard van de app (die
// staat erbij als voorbeeld).
import React, { useState } from "react";
import { SlidersHorizontal, PenLine, Check, AlertTriangle, Trash2 } from "lucide-react";
import { INK, INK_SOFT, LINE, STAMP, DANGER, PAPER, SANS } from "../constants.js";
import { Field, TextInput, Select, QuickChips } from "./velden.jsx";
import { SignaturePad } from "./SignaturePad.jsx";
import { STANDAARD_VELDEN, appStandaard, schoonStandaarden } from "../domein/standaarden.js";
import { getalVoorInvoer } from "../lib/format.js";

const toonAppStandaard = (v) => {
  const w = appStandaard(v.k);
  if (v.soort === "janee") return w ? "ja" : "nee";
  if (w === "" || w === null || w === undefined) return "leeg";
  return v.soort === "getal" ? getalVoorInvoer(w) : String(w);
};

function Melding({ status }) {
  if (!status) return null;
  return (
    <div role={status.ok ? "status" : "alert"} className="flex items-center gap-1.5 text-xs mt-3" style={{ color: status.ok ? STAMP : DANGER }}>
      {status.ok ? <Check size={13} /> : <AlertTriangle size={13} />} {status.tekst}
    </div>
  );
}

export function MijnStandaarden({ voorkeuren, onBewaar }) {
  const beschikbaar = !(voorkeuren && voorkeuren.beschikbaar === false);
  const [waarden, setWaarden] = useState(() => ({ ...((voorkeuren && voorkeuren.standaarden) || {}) }));
  const [status, setStatus] = useState(null);
  const [bezig, setBezig] = useState(false);
  const [nieuweHandtekening, setNieuweHandtekening] = useState("");
  const [hStatus, setHStatus] = useState(null);
  const bewaardeHandtekening = (voorkeuren && voorkeuren.handtekening) || "";

  const zet = (k, w) => setWaarden((x) => {
    const n = { ...x };
    if (w === "" || w === undefined) delete n[k]; else n[k] = w;
    return n;
  });
  const bewaar = async () => {
    setBezig(true); setStatus(null);
    try {
      const schoon = schoonStandaarden(waarden);
      const genegeerd = Object.keys(waarden).filter((k) => !(k in schoon));
      await onBewaar({ standaarden: schoon });
      setWaarden(schoon);
      setStatus(genegeerd.length
        ? { ok: false, tekst: `Bewaard, behalve ${genegeerd.map((k) => STANDAARD_VELDEN.find((v) => v.k === k)?.label || k).join(", ")} (ongeldige waarde).` }
        : { ok: true, tekst: "Bewaard — elk nieuw dossier start voortaan met deze waarden." });
    } catch (e) {
      setStatus({ ok: false, tekst: e.message || "Opslaan mislukt." });
    } finally {
      setBezig(false);
    }
  };
  const bewaarHandtekening = async (h) => {
    setHStatus(null);
    try {
      await onBewaar({ handtekening: h });
      setNieuweHandtekening("");
      setHStatus({ ok: true, tekst: h ? "Handtekening bewaard." : "Bewaarde handtekening verwijderd." });
    } catch (e) {
      setHStatus({ ok: false, tekst: e.message || "Opslaan mislukt." });
    }
  };

  if (!beschikbaar) {
    return (
      <div className="text-xs px-3 py-2 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
        Persoonlijke standaarden en een bewaarde handtekening zijn nog niet geactiveerd voor deze app
        (de beheerder voert daarvoor eerst supabase/persoonlijke-voorkeuren.sql uit).
      </div>
    );
  }

  const groepen = [...new Set(STANDAARD_VELDEN.map((v) => v.groep))];
  return (
    <>
      <section aria-labelledby="kop-standaarden" className="mb-10">
        <div id="kop-standaarden" className="flex items-center gap-2 mb-1" style={{ fontFamily: SANS, fontSize: 15, fontWeight: 600, color: INK }}>
          <SlidersHorizontal size={15} style={{ color: STAMP }} /> Mijn standaarden voor een nieuw dossier
        </div>
        <div className="text-xs mb-4" style={{ color: INK_SOFT }}>
          Waarden die je in bijna elk dossier anders zet dan de app. Elk nieuw dossier start ermee; in het dossier kan je ze altijd
          aanpassen. Laat een veld leeg om de standaard van de app te houden. Bestaande dossiers veranderen niet.
        </div>
        {groepen.map((g) => (
          <div key={g} className="mb-4">
            <div className="text-xs mb-2" style={{ color: INK_SOFT, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{g}</div>
            <div className="grid gap-3">
              {STANDAARD_VELDEN.filter((v) => v.groep === g).map((v) => {
                const hint = `Standaard van de app: ${toonAppStandaard(v)}`;
                if (v.soort === "janee") {
                  const w = waarden[v.k];
                  return (
                    <Field key={v.k} label={v.label} hint={hint}>
                      <Select zonderOnbekend leeg="— standaard van de app —" options={["Ja", "Nee"]}
                        value={w === true ? "Ja" : w === false ? "Nee" : ""}
                        onChange={(e) => zet(v.k, e.target.value === "Ja" ? true : e.target.value === "Nee" ? false : "")} />
                    </Field>
                  );
                }
                if (v.soort === "keuze") {
                  return (
                    <Field key={v.k} label={v.label} hint={hint}>
                      <Select zonderOnbekend leeg="— standaard van de app —" options={v.opties()} value={waarden[v.k] || ""} onChange={(e) => zet(v.k, e.target.value)} />
                    </Field>
                  );
                }
                return (
                  <Field key={v.k} label={v.label} hint={hint}>
                    <TextInput type={v.soort === "getal" ? "number" : "text"} value={waarden[v.k] ?? ""} placeholder={v.hint || ""}
                      onChange={(e) => zet(v.k, e.target.value)} />
                    {v.snelkeuze && <QuickChips options={v.snelkeuze()} onPick={(o) => zet(v.k, o)} />}
                  </Field>
                );
              })}
            </div>
          </div>
        ))}
        <button type="button" onClick={bewaar} disabled={bezig} className="text-sm px-4 py-2 rounded-lg"
          style={{ background: INK, color: PAPER, fontWeight: 500, opacity: bezig ? 0.6 : 1 }}>
          {bezig ? "Bezig met opslaan..." : "Standaarden opslaan"}
        </button>
        <Melding status={status} />
      </section>

      <section aria-labelledby="kop-handtekening" className="mb-10">
        <div id="kop-handtekening" className="flex items-center gap-2 mb-1" style={{ fontFamily: SANS, fontSize: 15, fontWeight: 600, color: INK }}>
          <PenLine size={15} style={{ color: STAMP }} /> Mijn handtekening
        </div>
        <div className="text-xs mb-3" style={{ color: INK_SOFT }}>
          Enkel voor jou zichtbaar. In een dossier plaats je ze met één klik onder de eedformule (tabblad Opdracht & partijen) —
          dat blijft per verslag jouw eigen beslissing, er wordt niets automatisch ondertekend.
        </div>
        {bewaardeHandtekening ? (
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <img src={bewaardeHandtekening} alt="Bewaarde handtekening" style={{ height: 70, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 6, padding: 4 }} />
            <button type="button" onClick={() => bewaarHandtekening("")} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ border: `1px solid ${LINE}`, color: DANGER }}>
              <Trash2 size={13} /> Verwijderen
            </button>
          </div>
        ) : (
          <div className="text-xs mb-2" style={{ color: INK_SOFT }}>Nog geen handtekening bewaard. Teken ze hieronder, of bewaar ze vanuit een dossier.</div>
        )}
        <SignaturePad value={nieuweHandtekening} onChange={(e) => setNieuweHandtekening(e && e.target ? e.target.value : e)} />
        {nieuweHandtekening && (
          <button type="button" onClick={() => bewaarHandtekening(nieuweHandtekening)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg mt-2 text-white"
            style={{ background: STAMP, fontWeight: 500 }}>
            <Check size={13} /> {bewaardeHandtekening ? "Deze handtekening bewaren i.p.v. de vorige" : "Handtekening bewaren"}
          </button>
        )}
        <Melding status={hStatus} />
      </section>
    </>
  );
}
