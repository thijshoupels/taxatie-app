// ----------------------------------------------------------------------------
// stappen/StepAfmetingen.jsx — wizardtabblad "Afmetingen & indeling"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10) zonder de logica/opmaak zelf te
// wijzigen.
import React from "react";
import { Ruler, Grid3x3, Plus, Trash2 } from "lucide-react";
import { OPTS, INK_SOFT, LINE, BRASS, BRASS_SOFT, STAMP, STAMP_SOFT, DANGER, VERDIEPINGEN } from "../constants.js";
import { num, eur } from "../lib/format.js";
import { Field, inputStyle, TextInput, Select, Checkbox, Section } from "../ui/velden.jsx";

// ---------- afmetingen & indeling ----------
export function StepAfmetingen({ d, set, calc, addRuimte, removeRuimte, updateRuimte, addSchijf, removeSchijf, updateSchijf }) {
  // "Bewoonbare oppervlakte" is een residentieel begrip — bij KMO-vastgoed/Bedrijfsvastgoed is
  // "nuttige vloeroppervlakte" de courante term (het onderliggende veld bewoonbareOppSchatting
  // blijft ongewijzigd, dit is enkel het label/de weergave).
  const isResidentieel = d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed";
  const oppLabel = isResidentieel ? "Bewoonbare oppervlakte" : "Nuttige vloeroppervlakte";
  return (
    <div>
      <Section title="Afmetingen" icon={Ruler}>
        <Field label="Gevelbreedte (m)"><TextInput type="number" value={d.breedteGevel} onChange={set("breedteGevel")} /></Field>
        <Field label="Perceelbreedte (m)"><TextInput type="number" value={d.breedtePerceel} onChange={set("breedtePerceel")} /></Field>
        <Field label="Grondoppervlakte (m²)"><TextInput type="number" value={d.grondopp} onChange={set("grondopp")} /></Field>
        <Field label="Bebouwde oppervlakte (m²)"><TextInput type="number" value={d.bebouwdeOpp} onChange={set("bebouwdeOpp")} /></Field>
        <Field label={`${oppLabel} — schatting (m²)`} hint="Manuele inschatting; wordt vergeleken met de berekende oppervlakte hieronder">
          <TextInput type="number" value={d.bewoonbareOppSchatting} onChange={set("bewoonbareOppSchatting")} />
        </Field>
        <Field label="Oriëntatie"><Select options={OPTS.orientatie} value={d.orientatie} onChange={set("orientatie")} /></Field>
      </Section>

      <Section title="Oppervlakte per bouweenheid" icon={Grid3x3}>
        <div className="col-span-2">
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.02)" }}>
                  {["Verdieping", "Opp. (m²)", "Coëff.", "Na coëff.", ""].map((h) => (
                    <th key={h} className="text-left px-3 py-2" style={{ fontSize: 12, color: INK_SOFT, fontWeight: 500, borderBottom: `1px solid ${LINE}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calc.ruimteRows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                    <td className="px-2 py-1.5">
                      <select value={r.verdieping} onChange={(e) => {
                        updateRuimte(r.id, "verdieping", e.target.value);
                        const v = VERDIEPINGEN.find((x) => x.key === e.target.value);
                        if (v) updateRuimte(r.id, "coeff", v.defCoeff);
                      }} style={{ ...inputStyle, padding: "5px 8px", fontSize: 13 }}>
                        {VERDIEPINGEN.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5" style={{ width: 90 }}>
                      <input type="number" value={r.opp} onChange={(e) => updateRuimte(r.id, "opp", e.target.value)}
                        style={{ ...inputStyle, padding: "5px 8px", fontSize: 13 }} />
                    </td>
                    <td className="px-2 py-1.5" style={{ width: 80 }}>
                      <input type="number" step="0.05" value={r.coeff} onChange={(e) => updateRuimte(r.id, "coeff", e.target.value)}
                        style={{ ...inputStyle, padding: "5px 8px", fontSize: 13, color: BRASS }} />
                    </td>
                    <td className="px-3 py-1.5 font-mono" style={{ fontSize: 13, color: INK_SOFT }}>{r.oppNaCoeff.toFixed(2)} m²</td>
                    <td className="px-2 py-1.5"><button onClick={() => removeRuimte(r.id)}><Trash2 size={14} style={{ color: DANGER }} /></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: STAMP_SOFT }}>
                  <td className="px-3 py-2 text-sm" style={{ fontWeight: 500, color: STAMP }}>Totaal</td>
                  <td className="px-3 py-2 font-mono text-sm" style={{ color: STAMP, fontWeight: 500 }}>{calc.totOpp.toFixed(2)} m²</td>
                  <td></td>
                  <td className="px-3 py-2 font-mono text-sm" style={{ color: STAMP, fontWeight: 500 }}>{calc.totOppNaCoeff.toFixed(2)} m²</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <button onClick={addRuimte} className="flex items-center gap-1.5 text-xs mt-2 px-3 py-1.5 rounded-lg"
            style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
            <Plus size={13} /> Ruimte toevoegen
          </button>
          {d.pandType === "Appartement" && (
            <div className="mt-3 max-w-xs">
              <Field label="Aandeel gemeenschappelijke delen (m²)"
                hint="Aandeel van deze kavel in de gemeenschappelijke binnendelen van het gebouw (traphal, gangen, technische lokalen, ...) — telt volledig mee in de te taxeren oppervlakte hierboven.">
                <TextInput type="number" value={d.gemeenschappelijkeDelenOpp} onChange={set("gemeenschappelijkeDelenOpp")} />
              </Field>
            </div>
          )}
          <div className="text-xs mt-2" style={{ color: INK_SOFT }}>
            Ratio gecorrigeerde / nuttige oppervlakte: <span className="font-mono">{(calc.ratio * 100).toFixed(1)}%</span>
            {d.bewoonbareOppSchatting && (
              <> · schatting vs. berekend:{" "}
                <span className="font-mono" style={{ color: Math.abs(num(d.bewoonbareOppSchatting) - calc.totOppNaCoeff) > 5 ? DANGER : STAMP }}>
                  {d.bewoonbareOppSchatting} m² vs. {calc.totOppNaCoeff.toFixed(1)} m²
                </span>
              </>
            )}
          </div>
        </div>
      </Section>

      {d.pandType === "Appartement" && (
        <Section title="Aandeel in de gemeenschap" icon={Ruler}>
          <Field label="Aandeel in de gemeenschap (in 1000sten)" hint="Quotiteit van deze kavel in de mede-eigendom, zoals vermeld in de statuten/basisakte.">
            <TextInput type="number" value={d.aandeelDuizendsten} onChange={set("aandeelDuizendsten")} placeholder="bv. 137" />
          </Field>
          <Field label="Effectief grondaandeel" hint="Berekend als: Grondoppervlakte (hierboven, = totale grondoppervlakte van de residentie) × aandeel / 1000.">
            <div className="flex items-center gap-2">
              <div style={{ ...inputStyle, background: "rgba(0,0,0,0.02)", color: STAMP, fontWeight: 500 }} className="font-mono">
                {calc.effectiefGrondaandeel.toFixed(2)} m²
              </div>
              {calc.effectiefGrondaandeel > 0 && (
                <button type="button" onClick={() => addSchijf("Aandeel in gemeenschappelijke grond", calc.effectiefGrondaandeel.toFixed(2))}
                  className="flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg"
                  style={{ border: `1px solid ${BRASS}`, color: BRASS, background: BRASS_SOFT }}>
                  <Plus size={13} /> Als schijf
                </button>
              )}
            </div>
          </Field>
          {!d.grondopp && (
            <div className="col-span-2 text-xs" style={{ color: INK_SOFT }}>
              Vul hierboven bij "Grondoppervlakte" de totale grondoppervlakte van de residentie/het complex in om het effectief grondaandeel te berekenen.
            </div>
          )}
        </Section>
      )}

      <Section title="Grondwaarde per schijf" icon={Ruler}>
        <div className="col-span-2">
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.02)" }}>
                  {["Omschrijving", "Opp. (m²)", "Prijs/m²", "Waarde", ""].map((h) => (
                    <th key={h} className="text-left px-3 py-2" style={{ fontSize: 12, color: INK_SOFT, fontWeight: 500, borderBottom: `1px solid ${LINE}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.schijven.map((s) => (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                    <td className="px-2 py-1.5">
                      <input value={s.naam} onChange={(e) => updateSchijf(s.id, "naam", e.target.value)} style={{ ...inputStyle, padding: "5px 8px", fontSize: 13 }} />
                    </td>
                    <td className="px-2 py-1.5" style={{ width: 110 }}>
                      <input type="number" value={s.opp} onChange={(e) => updateSchijf(s.id, "opp", e.target.value)} style={{ ...inputStyle, padding: "5px 8px", fontSize: 13, color: BRASS }} />
                    </td>
                    <td className="px-2 py-1.5" style={{ width: 110 }}>
                      <input type="number" value={s.prijs} onChange={(e) => updateSchijf(s.id, "prijs", e.target.value)} style={{ ...inputStyle, padding: "5px 8px", fontSize: 13, color: BRASS }} />
                    </td>
                    <td className="px-3 py-1.5 font-mono" style={{ fontSize: 13, color: INK_SOFT }}>{eur(num(s.opp) * num(s.prijs))}</td>
                    <td className="px-2 py-1.5"><button onClick={() => removeSchijf(s.id)}><Trash2 size={14} style={{ color: DANGER }} /></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: STAMP_SOFT }}>
                  <td className="px-3 py-2 text-sm" style={{ fontWeight: 500, color: STAMP }}>Totaal grondwaarde</td>
                  <td className="px-3 py-2 font-mono text-sm" style={{ color: STAMP }}>{calc.totaleGrondopp.toFixed(0)} m²</td>
                  <td></td>
                  <td className="px-3 py-2 font-mono text-sm" style={{ color: STAMP, fontWeight: 500 }}>{eur(calc.grondwaarde)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button onClick={() => addSchijf()} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
              <Plus size={13} /> Schijf toevoegen
            </button>
            <button onClick={() => addSchijf("Landbouwgrond")} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ border: `1px solid ${BRASS}`, color: BRASS, background: BRASS_SOFT }}>
              <Plus size={13} /> Landbouwgrond toevoegen
            </button>
            <button onClick={() => addSchijf("Bosgrond")} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ border: `1px solid ${BRASS}`, color: BRASS, background: BRASS_SOFT }}>
              <Plus size={13} /> Bosgrond toevoegen
            </button>
          </div>
        </div>
      </Section>

      <Section title="Residuele grondwaarde (optioneel)" icon={Ruler}>
        <div className="col-span-2">
          <Checkbox label="Residuele methode toepassen — enkel relevant bij een reëel sloop-/herontwikkelingspotentieel"
            checked={d.residueelActief} onChange={set("residueelActief")} />
          <div className="text-xs mt-1" style={{ color: INK_SOFT, opacity: 0.85 }}>
            Optionele extra, staat standaard uit. Vervangt de gewone grondwaarde per schijf hierboven niet — verschijnt er enkel naast in het waarderingsoverzicht, zodat u zelf kiest welke van de twee het best bij dit dossier past.
          </div>
        </div>
        {d.residueelActief && (
          <>
            <Field label="Verwachte eindwaarde na (her)ontwikkeling (€)" hint="Geschatte verkoopwaarde van het pand/project ná realisatie">
              <TextInput type="number" value={d.residueelEindwaarde} onChange={set("residueelEindwaarde")} style={{ color: BRASS }} />
            </Field>
            <Field label="Geraamde bouw-/sloopkost (€)">
              <TextInput type="number" value={d.residueelBouwkost} onChange={set("residueelBouwkost")} style={{ color: BRASS }} />
            </Field>
            <Field label="Bijkomende kosten (%)" hint="Ereloon architect, vergunningen, financiering e.d., als % op de bouwkost">
              <TextInput type="number" step="0.5" value={d.residueelBijkomendeKostenPct} onChange={set("residueelBijkomendeKostenPct")} style={{ color: BRASS }} />
            </Field>
            <Field label="Ontwikkelaarswinst/risico (%)" hint="Als % op de eindwaarde">
              <TextInput type="number" step="0.5" value={d.residueelWinstmargePct} onChange={set("residueelWinstmargePct")} style={{ color: BRASS }} />
            </Field>
            <Field label="Residuele grondwaarde (berekend)" full>
              <div className="font-mono text-sm py-2" style={{ color: STAMP, fontWeight: 500 }}>{eur(calc.residueleGrondwaarde)}</div>
            </Field>
            <Field label="Motivering / toelichting" full>
              <textarea value={d.residueelMotivering} onChange={set("residueelMotivering")} rows={2}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </Field>
          </>
        )}
      </Section>
    </div>
  );
}
