// ----------------------------------------------------------------------------
// stappen/VglWaarderingPaneel.jsx — waardering volgens de vergelijkende methode (tabblad VGL-punten)
// ----------------------------------------------------------------------------
// VglCorrecties: de correctievelden per vergelijkingspunt (+ wat er per punt uit de berekening komt).
// VglWaarderingPaneel: instellingen, resultaat en waarschuwingen onderaan het tabblad.
// De berekening zelf zit in domein/vglWaardering.js (via berekenWaardering -> calc.vgl).
import React from "react";
import { Scale, AlertTriangle } from "lucide-react";
import { INK, INK_SOFT, LINE, PAPER_RAISED, ACCENT, ACCENT_SOFT, DANGER, STAMP } from "../constants.js";
import { Field, TextInput, inputStyle } from "../ui/velden.jsx";
import { eur } from "../lib/format.js";

const perM2 = (x) => `${eur(x)}/m²`;
const pctTekst = (x) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${String(Math.abs(Math.round(x * 10) / 10)).replace(".", ",")}%`;

export function VglCorrecties({ v, update, resultaat }) {
  const veld = (sleutel, label) => (
    <label className="block">
      <span className="block text-xs mb-1" style={{ color: INK_SOFT, fontWeight: 500 }}>{label}</span>
      <TextInput type="number" step="0.5" value={v[sleutel] || ""} placeholder="0" onChange={(e) => update(v.id, sleutel, e.target.value)} />
    </label>
  );
  return (
    <div className="md:col-span-2 rounded-lg p-3" style={{ border: `1px dashed ${LINE}` }}>
      <div className="text-xs mb-2" style={{ color: INK, fontWeight: 500 }}>Correcties t.o.v. het te schatten goed (in %, + = het te schatten goed is beter)</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {veld("correctieLigging", "Ligging (%)")}
        {veld("correctieStaat", "Staat & afwerking (%)")}
        {veld("correctieOverig", "Overige, bv. EPC (%)")}
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
          placeholder="Bv. ligging aan een drukke gewestweg (−5%); keuken en badkamer recent vernieuwd (+5%)"
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
      </label>
      {resultaat && (
        <div className="text-xs mt-2" style={{ color: resultaat.bruikbaar ? INK : INK_SOFT, fontVariantNumeric: "tabular-nums" }}>
          {resultaat.bruikbaar ? (
            <>
              <strong>{perM2(resultaat.prijsPerM2Basis)}</strong> na grond{resultaat.tijdfactor !== 1 ? "- en tijd" : ""}correctie
              {resultaat.grondcorrectie ? ` (grondcorrectie ${resultaat.grondcorrectie > 0 ? "+" : "−"}${eur(Math.abs(resultaat.grondcorrectie))})` : ""}
              {resultaat.correctiePct ? ` → correctie ${pctTekst(resultaat.correctiePct)} → ` : " → "}
              <strong>{perM2(resultaat.prijsPerM2)}</strong>
              {resultaat.opmerkingen.map((o) => <div key={o} style={{ color: DANGER }}>• {o}</div>)}
            </>
          ) : (
            <>Telt niet mee in de vergelijkende waardering: {resultaat.reden}.</>
          )}
        </div>
      )}
    </div>
  );
}

export function VglWaarderingPaneel({ d, calc, set }) {
  const v = calc?.vgl;
  if (!v) return null;
  const bruikbaar = v.punten.filter((p) => p.bruikbaar);
  const kanGebruiken = v.waarde > 0;
  const isApp = d.pandType === "Appartement";
  return (
    <div className="mt-8 mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Scale size={15} style={{ color: ACCENT }} />
        <h3 style={{ fontSize: 16, color: INK, fontWeight: 500 }}>Waardering volgens de vergelijkende methode</h3>
      </div>
      <div className="text-xs mb-3" style={{ color: INK_SOFT, lineHeight: 1.6 }}>
        Per vergelijkingspunt: prijs{!isApp && " + correctie voor het verschil in perceeloppervlakte"}{v.marktevolutiePct ? " × marktevolutie" : ""},
        gedeeld door de gewogen nuttige oppervlakte, en daarna jouw correcties in %. Het gewogen gemiddelde van die m²-prijzen,
        maal de gewogen nuttige oppervlakte van het te schatten goed, geeft de vergelijkende waarde. De app stelt zelf geen
        correctiepercentages voor: dat blijft jouw deskundig oordeel, met motivering.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {!isApp && (
          <Field label="Grondcorrectieprijs (€/m²)" hint={v.grondprijsIsStandaard || d.vglGrondcorrectiePrijs === "" || d.vglGrondcorrectiePrijs === undefined
            ? `Standaard de laagste prijs uit de grondschijven${v.grondprijs ? ` (${perM2(v.grondprijs)})` : " — nog geen schijven ingevuld"}: extra of minder grond is meestal tuin, geen bouwgrond`
            : "Manueel ingevuld — wordt gebruikt voor het verschil in perceeloppervlakte"}>
            <TextInput type="number" value={d.vglGrondcorrectiePrijs || ""} placeholder={v.grondprijs ? String(v.grondprijs) : ""} onChange={set("vglGrondcorrectiePrijs")} />
          </Field>
        )}
        <Field label="Marktevolutie (% per jaar)" hint="Optioneel: indexeert elke verkoop naar de referentiedatum. Leeg = geen tijdcorrectie.">
          <TextInput type="number" step="0.5" value={d.vglMarktevolutiePct || ""} placeholder="0" onChange={set("vglMarktevolutiePct")} />
        </Field>
      </div>

      {bruikbaar.length > 0 && (
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs" style={{ borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr style={{ color: INK_SOFT, textAlign: "left" }}>
                {["VGL", "Prijs", !isApp && "Grondcorr.", "€/m² basis", "Correctie", "€/m² gecorr.", "Weging"].filter(Boolean).map((h) => (
                  <th key={h} style={{ padding: "4px 8px 4px 0", borderBottom: `1px solid ${LINE}`, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bruikbaar.map((p) => (
                <tr key={p.id} style={{ borderBottom: `1px dotted ${LINE}`, color: p.uitschieter ? DANGER : INK }}>
                  <td style={{ padding: "4px 8px 4px 0" }}>{p.nr}{p.adres ? ` — ${p.adres}` : ""}{p.uitschieter ? " ⚠" : ""}</td>
                  <td style={{ padding: "4px 8px 4px 0" }}>{eur(p.prijs)}</td>
                  {!isApp && <td style={{ padding: "4px 8px 4px 0" }}>{p.grondcorrectie ? `${p.grondcorrectie > 0 ? "+" : "−"}${eur(Math.abs(p.grondcorrectie))}` : "—"}</td>}
                  <td style={{ padding: "4px 8px 4px 0" }}>{perM2(p.prijsPerM2Basis)}</td>
                  <td style={{ padding: "4px 8px 4px 0" }}>{p.correctiePct ? pctTekst(p.correctiePct) : "—"}</td>
                  <td style={{ padding: "4px 8px 4px 0", fontWeight: 600 }}>{perM2(p.prijsPerM2)}</td>
                  <td style={{ padding: "4px 8px 4px 0" }}>{p.weging}×</td>
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
            <span style={{ color: INK_SOFT }}>Gewogen gemiddelde</span><span>{perM2(v.gemiddeldePerM2)}</span>
            <span style={{ color: INK_SOFT }}>Mediaan</span><span>{perM2(v.mediaanPerM2)}</span>
            <span style={{ color: INK_SOFT }}>Laagste – hoogste</span><span>{perM2(v.minPerM2)} – {perM2(v.maxPerM2)}</span>
            <span style={{ color: INK_SOFT }}>Spreiding (variatiecoëfficiënt)</span><span>{Math.round(v.spreiding * 100)}%</span>
            <span style={{ color: INK_SOFT }}>× gewogen nuttige opp. te schatten goed</span><span>{v.onderwerpOpp.toFixed(1)} m²</span>
          </div>
          <div className="flex items-baseline justify-between mt-3 pt-3" style={{ borderTop: `1px dotted ${LINE}` }}>
            <span style={{ fontSize: 14, color: STAMP, fontWeight: 500 }}>Vergelijkende waarde{v.volwaardig ? "" : " (indicatief)"}</span>
            <span className="font-mono" style={{ fontSize: 20, color: STAMP, fontWeight: 500 }}>{eur(v.waarde)}</span>
          </div>
          <div className="text-xs mt-1" style={{ color: INK_SOFT }}>
            Bandbreedte op basis van de laagste en hoogste punt: {eur(v.waardeMin)} – {eur(v.waardeMax)}
            {v.afwijkingIntrinsiek !== null && <> · intrinsieke waarde {eur(calc.intrinsiek)} ({pctTekst(v.afwijkingIntrinsiek * 100)} t.o.v. de intrinsieke waarde)</>}
          </div>
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
              placeholder="Bv. keuze van de punten, gehanteerde grondcorrectie, verklaring van een verschil met de intrinsieke waarde"
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </label>
        )}
      </div>
    </div>
  );
}
