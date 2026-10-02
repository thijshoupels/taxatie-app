// ----------------------------------------------------------------------------
// stappen/VglWaarderingPaneel.jsx — waardering volgens de vergelijkende methode (tabblad VGL-punten)
// ----------------------------------------------------------------------------
// VglCorrecties: per vergelijkingspunt het voorstel dat de app zelf berekent (grond volgens de
// grondschijven + gebouwwaarde per m²) en de correctievelden waarmee de schatter bijstuurt.
// VglWaarderingPaneel: overzicht, resultaat en waarschuwingen onderaan het tabblad.
// De berekening zelf zit in domein/vglWaardering.js (via berekenWaardering -> calc.vgl).
import React from "react";
import { Scale, AlertTriangle } from "lucide-react";
import { INK, INK_SOFT, LINE, PAPER_RAISED, ACCENT, ACCENT_SOFT, DANGER, STAMP } from "../constants.js";
import { Field, TextInput, inputStyle } from "../ui/velden.jsx";
import { eur } from "../lib/format.js";

const pctTekst = (x) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${String(Math.abs(Math.round(x * 10) / 10)).replace(".", ",")}%`;
const m2 = (x) => `${Math.round(x * 10) / 10} m²`.replace(".", ",");

export function VglCorrecties({ v, update, resultaat, onderwerpOpp }) {
  const veld = (sleutel, label) => (
    <label className="block">
      <span className="block text-xs mb-1" style={{ color: INK_SOFT, fontWeight: 500 }}>{label}</span>
      <TextInput type="number" step="0.5" value={v[sleutel] || ""} placeholder="0" onChange={(e) => update(v.id, sleutel, e.target.value)} />
    </label>
  );
  const r = resultaat;
  return (
    <div className="md:col-span-2 rounded-lg p-3" style={{ border: `1px dashed ${LINE}` }}>
      {r && r.bruikbaar && (
        <div className="text-sm mb-3 p-2 rounded" style={{ background: ACCENT_SOFT, color: INK, fontVariantNumeric: "tabular-nums", lineHeight: 1.6 }}>
          <div style={{ fontWeight: 500 }}>Voorstel voor het te schatten goed: {eur(r.voorstel)}{r.voorstel !== r.voorstelZonderCorrecties ? ` (zonder correcties ${eur(r.voorstelZonderCorrecties)})` : ""}</div>
          <div className="text-xs" style={{ color: INK_SOFT }}>
            {eur(r.prijsNaTijd)}{r.tijdfactor !== 1 ? " (na marktevolutie)" : ""}
            {r.grondApart ? <> − grond {eur(r.grondVgl)} (volgens je grondschijven)</> : null}
            {" "}= gebouw {eur(r.gebouwVgl)} ÷ {m2(r.opp)} = <strong>{eur(r.gebouwPerM2)}/m²</strong>
            {" "}→ × {m2(onderwerpOpp)} = {eur(r.gebouwOnderwerp)}
            {r.gebouwCorrPct ? <> · gebouwcorrectie {pctTekst(r.gebouwCorrPct)} → {eur(r.gebouwOnderwerpNaCorr)}</> : null}
            {r.grondApart ? <> + grond te schatten goed {eur(r.grondOnderwerp)}</> : null}
            {r.totaalCorrPct ? <> · correctie geheel {pctTekst(r.totaalCorrPct)}</> : null}
          </div>
          {r.opmerkingen.map((o) => <div key={o} className="text-xs" style={{ color: DANGER }}>• {o}</div>)}
        </div>
      )}
      {r && !r.bruikbaar && (
        <div className="text-xs mb-3" style={{ color: INK_SOFT }}>Nog geen voorstel: {r.reden}.</div>
      )}
      <div className="text-xs mb-2" style={{ color: INK, fontWeight: 500 }}>Bijsturen (in %, + = het te schatten goed is beter dan dit VGL-punt)</div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {veld("correctieVetusteit", "Vetusteit (% gebouw)")}
        {veld("correctieStaat", "Staat & afwerking (% gebouw)")}
        {veld("correctieLigging", "Ligging (% geheel)")}
        {veld("correctieOverig", "Overige, bv. EPC (% geheel)")}
        <label className="block">
          <span className="block text-xs mb-1" style={{ color: INK_SOFT, fontWeight: 500 }}>Weging</span>
          <select value={v.weging === undefined || v.weging === "" ? "1" : String(v.weging)} onChange={(e) => update(v.id, "weging", e.target.value)} style={inputStyle}>
            <option value="1">Normaal (1×)</option>
            <option value="2">Zeer vergelijkbaar (2×)</option>
            <option value="0">Telt niet mee</option>
          </select>
        </label>
      </div>
      <label className="block mt-3">
        <span className="block text-xs mb-1" style={{ color: INK_SOFT, fontWeight: 500 }}>Motivering van de correcties (komt in het verslag)</span>
        <textarea value={v.correctieMotivering || ""} onChange={(e) => update(v.id, "correctieMotivering", e.target.value)} rows={2}
          placeholder="Bv. VGL-punt 20 jaar jonger (vetusteit +10%); ligging aan een drukke gewestweg (+5% voor het te schatten goed)"
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
      </label>
    </div>
  );
}

export function VglWaarderingPaneel({ d, calc, set }) {
  const v = calc?.vgl;
  if (!v) return null;
  const bruikbaar = v.punten.filter((p) => p.bruikbaar);
  const kanGebruiken = v.waarde > 0;
  const cel = { padding: "4px 8px 4px 0" };
  return (
    <div className="mt-8 mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Scale size={15} style={{ color: ACCENT }} />
        <h3 style={{ fontSize: 16, color: INK, fontWeight: 500 }}>Waardering volgens de vergelijkende methode</h3>
      </div>
      <div className="text-xs mb-3" style={{ color: INK_SOFT, lineHeight: 1.6 }}>
        Per VGL-punt berekent de app zelf een voorstel, zoals bij de analytische methode:
        {v.grondApart
          ? " de grond van het VGL-punt wordt gewaardeerd met jouw grondschijven, de rest van de prijs is de gebouwwaarde. Die gebouwwaarde per m² gewogen nuttige oppervlakte, maal de oppervlakte van het te schatten goed, plus de grondwaarde van het te schatten goed, geeft het voorstel."
          : " de prijs per m² gewogen nuttige oppervlakte, maal de oppervlakte van het te schatten goed."}
        {" "}Met vetusteit, staat, ligging en overige correcties stuur je elk voorstel bij. De vergelijkende waarde is het gewogen gemiddelde van de voorstellen.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Field label="Marktevolutie (% per jaar)" hint="Optioneel: indexeert elke verkoop naar de referentiedatum. Leeg = geen tijdcorrectie.">
          <TextInput type="number" step="0.5" value={d.vglMarktevolutiePct || ""} placeholder="0" onChange={set("vglMarktevolutiePct")} />
        </Field>
      </div>

      {bruikbaar.length > 0 && (
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs" style={{ borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr style={{ color: INK_SOFT, textAlign: "left" }}>
                {["VGL", "Prijs", v.grondApart && "Grond (schijven)", "Gebouw/m²", "Voorstel", "Correcties", "Voorstel na corr.", "Weging"].filter(Boolean).map((h) => (
                  <th key={h} style={{ ...cel, borderBottom: `1px solid ${LINE}`, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bruikbaar.map((p) => (
                <tr key={p.id} style={{ borderBottom: `1px dotted ${LINE}`, color: p.uitschieter ? DANGER : INK }}>
                  <td style={cel}>{p.nr}{p.adres ? ` — ${p.adres}` : ""}{p.uitschieter ? " ⚠" : ""}</td>
                  <td style={cel}>{eur(p.prijs)}</td>
                  {v.grondApart && <td style={cel}>{eur(p.grondVgl)}</td>}
                  <td style={cel}>{eur(p.gebouwPerM2)}</td>
                  <td style={cel}>{eur(p.voorstelZonderCorrecties)}</td>
                  <td style={cel}>{[p.gebouwCorrPct ? `gebouw ${pctTekst(p.gebouwCorrPct)}` : "", p.totaalCorrPct ? `geheel ${pctTekst(p.totaalCorrPct)}` : ""].filter(Boolean).join(", ") || "—"}</td>
                  <td style={{ ...cel, fontWeight: 600 }}>{eur(p.voorstel)}</td>
                  <td style={cel}>{p.weging}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {v.punten.length > bruikbaar.length && (
        <div className="text-xs mb-3" style={{ color: INK_SOFT }}>
          Niet meegeteld: {v.punten.filter((p) => !p.bruikbaar).map((p) => `VGL ${p.nr} (${p.reden})`).join("; ")}.
        </div>
      )}

      {v.waarde > 0 && (
        <div className="rounded-lg p-4 mb-3" style={{ background: PAPER_RAISED, border: `1px solid ${LINE}`, fontVariantNumeric: "tabular-nums" }}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {v.grondApart && <><span style={{ color: INK_SOFT }}>Grondwaarde te schatten goed (grondschijven)</span><span>{eur(v.grondOnderwerp)}</span></>}
            <span style={{ color: INK_SOFT }}>Gewogen nuttige opp. te schatten goed</span><span>{m2(v.onderwerpOpp)}</span>
            <span style={{ color: INK_SOFT }}>Mediaan van de voorstellen</span><span>{eur(v.mediaan)}</span>
            <span style={{ color: INK_SOFT }}>Laagste – hoogste voorstel</span><span>{eur(v.min)} – {eur(v.max)}</span>
            <span style={{ color: INK_SOFT }}>Spreiding (variatiecoëfficiënt)</span><span>{Math.round(v.spreiding * 100)}%</span>
          </div>
          <div className="flex items-baseline justify-between mt-3 pt-3" style={{ borderTop: `1px dotted ${LINE}` }}>
            <span style={{ fontSize: 14, color: STAMP, fontWeight: 500 }}>Vergelijkende waarde{v.volwaardig ? "" : " (indicatief)"} — gewogen gemiddelde</span>
            <span className="font-mono" style={{ fontSize: 20, color: STAMP, fontWeight: 500 }}>{eur(v.waarde)}</span>
          </div>
          {v.afwijkingIntrinsiek !== null && (
            <div className="text-xs mt-1" style={{ color: INK_SOFT }}>
              Intrinsieke waarde (analytische methode): {eur(calc.intrinsiek)} — de vergelijkende waarde ligt {pctTekst(v.afwijkingIntrinsiek * 100)} t.o.v. die waarde.
            </div>
          )}
        </div>
      )}

      {v.waarschuwingen.map((w) => (
        <div key={w} className="flex items-start gap-1.5 text-xs mb-2 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{w}</span>
        </div>
      ))}

      <div className="rounded-lg p-3 mt-3" style={{ background: ACCENT_SOFT }}>
        <label className="flex items-start gap-2 text-sm" style={{ color: INK, opacity: kanGebruiken ? 1 : 0.6 }}>
          <input type="checkbox" disabled={!kanGebruiken} checked={!!d.vglWaardeGebruiken && kanGebruiken}
            onChange={(e) => set("vglWaardeGebruiken")(e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            <strong>Gebruiken als basis voor de voorgestelde venale waarde</strong>
            <span className="block text-xs" style={{ color: INK_SOFT }}>
              Vervangt dan de intrinsieke waarde (die blijft in het verslag staan als controle). Zijn er huurgegevens, dan wordt het
              gemiddelde met de DCF-waarde genomen, zoals voorheen. Een manueel ingevulde venale waarde (tabblad Waardering) blijft altijd voorgaan.
              In het verslag verschijnen de punten zonder adres, behalve bij een nalatenschap (GDPR).
            </span>
          </span>
        </label>
        {d.vglWaardeGebruiken && kanGebruiken && (
          <label className="block mt-3">
            <span className="block text-xs mb-1" style={{ color: INK_SOFT, fontWeight: 500 }}>Algemene motivering van de vergelijkende waardering (komt in het verslag)</span>
            <textarea value={d.vglMotivering || ""} onChange={set("vglMotivering")} rows={2}
              placeholder="Bv. keuze van de punten, verklaring van een verschil met de intrinsieke waarde"
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </label>
        )}
      </div>
    </div>
  );
}
