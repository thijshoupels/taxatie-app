// ----------------------------------------------------------------------------
// stappen/StepVergelijkingspunten.jsx — wizardtabblad "Vergelijkingspunten & waarderingsmethode"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10) zonder de logica/opmaak zelf te
// wijzigen.
import React from "react";
import { Ruler, Trash2, Plus, AlertTriangle, Calculator } from "lucide-react";
import { OPTS, INK, LINE, PAPER_RAISED, ACCENT_SOFT, ACCENT, DANGER, INK_SOFT } from "../constants.js";
import { Section, Field, TextInput, Select, Checkbox, inputStyle } from "../ui/velden.jsx";
import { PRIJS_SOORTEN, CORRECTIES } from "../domein/vergelijking.js";
import { eur } from "../lib/format.js";

const m2 = (v) => `${(Math.round(v * 10) / 10).toLocaleString("nl-BE")} m²`;
import { VlabelVglPaneel } from "./VlabelVglPaneel.jsx";

// ---------- vergelijkingspunten & waarderingsmethode ----------
export function StepVergelijkingspunten({ d, calc, set, referentiedatum, addVergelijkingspunt, removeVergelijkingspunt, updateVergelijkingspunt }) {
  const vergelijkend = d.wijzeVanWaardering === "Vergelijkende methode";
  const vgl = calc && calc.vergelijking;
  const v2 = calc && calc.rekenversie === 2;
  return (
    <div>
      <Section title="Wijze van waardering" icon={Ruler}>
        <Field label="Methode" hint="Vergelijkende methode is de regel; analytische/redelijke methode enkel bij ontbreken van directe vergelijkingspunten, gemotiveerd">
          <Select zonderOnbekend options={OPTS.wijzeVanWaardering} value={d.wijzeVanWaardering} onChange={set("wijzeVanWaardering")} />
        </Field>
        {!vergelijkend && (
          <Field label="Motivering van de afwijking" full>
            <textarea value={d.wijzeVanWaarderingMotivering} onChange={set("wijzeVanWaarderingMotivering")} rows={3}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </Field>
        )}
      </Section>

      {/* Deze melding stond er voordien onvoorwaardelijk ("worden niet weergegeven in het verslag"),
          terwijl de vergelijkingspunten bij een nalatenschap net wél volledig worden afgedrukt (zie
          vglPuntenHtml in buildPandSections). De schatter kreeg dus een onjuiste geruststelling over
          wat er in een document staat dat naar Vlabel vertrekt. */}
      <div className="text-xs mb-4 p-3 rounded-lg" style={{ background: ACCENT_SOFT, color: INK }}>
        {d.reden === "Nalatenschap" && vergelijkend
          ? "Let op: bij een nalatenschap met de vergelijkende methode worden deze VGL-punten volledig in het verslag opgenomen (adres, kadastrale gegevens, transactiegegevens en afweging) — dat is een Vlabel-vereiste. Vul ze dus in met de wetenschap dat ze meegaan naar de opdrachtgever en naar Vlabel."
          : "VGL-punten worden hier intern bijgehouden ter staving van de waardering; in dit dossier verschijnt enkel het aantal in het verslag, niet de gegevens zelf."}
      </div>

      {/* Vlabel-lijst opladen, laten beoordelen en punten overnemen — zie VlabelVglPaneel.jsx */}
      {vergelijkend && <VlabelVglPaneel d={d} calc={calc} set={set} referentiedatum={referentiedatum} addVergelijkingspunt={addVergelijkingspunt} />}

      {/* vergelijkingsmethode als rekenmethode (rekenregels versie 2) — zie domein/vergelijking.js */}
      {vergelijkend && v2 && vgl && (
        <Section title="Vergelijkingsmethode" icon={Calculator}>
          <div className="col-span-2 text-xs" style={{ color: INK_SOFT, lineHeight: 1.55 }}>
            Per referentie: prijs → (bij een vraagprijs) min de onderhandelingsmarge → geïndexeerd naar de referentiedatum → gecorrigeerd
            voor ligging, staat, grootte en andere verschillen → per m² bewoonbare oppervlakte → × de oppervlakte van dit pand.
            De uitkomst weegt mee in de venale waarde (tabblad Waardering, "Weging van de methodes").
          </div>
          <Field label="Oppervlakte te schatten pand (m²)" hint={`Leeg = berekende oppervlakte na coëfficiënten (${m2(calc.totOppNaCoeff || 0)})`}>
            <TextInput type="number" value={d.vglOppTeSchatten || ""} onChange={set("vglOppTeSchatten")} placeholder={String(Math.round((calc.totOppNaCoeff || 0) * 10) / 10)} />
          </Field>
          <Field label="Onderhandelingsmarge op vraagprijzen (%)" hint="Een vraagprijs is een plafond; standaard 5%">
            <TextInput type="number" step="0.5" value={d.vglOnderhandelingsmargePct ?? ""} onChange={set("vglOnderhandelingsmargePct")} />
          </Field>
          <Field label="Marktindexatie (% per jaar)" hint="Optioneel — corrigeert oudere transacties naar de referentiedatum">
            <TextInput type="number" step="0.5" value={d.vglIndexPctPerJaar || ""} onChange={set("vglIndexPctPerJaar")} />
          </Field>
          <Field label="Uitkomst">
            <div className="font-mono text-sm py-2" style={{ color: vgl.aantal ? INK : INK_SOFT, fontWeight: 500 }}>
              {vgl.aantal ? `${eur(vgl.waarde)} (${vgl.aantal} referentie${vgl.aantal > 1 ? "s" : ""}${vgl.gemPerM2 ? `, gem. ${eur(vgl.gemPerM2)}/m²` : ""})` : "nog geen bruikbare referenties"}
            </div>
          </Field>
          {vgl.waarschuwingen.map((w) => (
            <div key={w} className="col-span-2 flex items-start gap-1.5 text-xs" style={{ color: DANGER }}>
              <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{w}</span>
            </div>
          ))}
          <Field label="Toelichting bij de vergelijking (optioneel, komt in het verslag)" full>
            <textarea value={d.vglMotivering || ""} onChange={set("vglMotivering")} rows={2}
              placeholder="Bv. referenties geselecteerd binnen 2 km, open bebouwing, verkocht in de laatste 24 maanden"
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </Field>
        </Section>
      )}

      {d.vergelijkingspunten.map((v, idx) => (
        <div key={v.id} className="rounded-lg p-4 mb-3" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: 14, fontWeight: 500 }}>Vergelijkingspunt {idx + 1}</span>
            <button onClick={() => removeVergelijkingspunt(v.id)}><Trash2 size={14} style={{ color: DANGER }} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Adres (postcode, gemeente, straat, nr.)" full>
              <TextInput value={v.adres} onChange={(e) => updateVergelijkingspunt(v.id, "adres", e.target.value)} />
            </Field>
            <Field label="Kadastrale gegevens" hint="Afdeling, sectie, perceelnr., partitienr., opp., KI, detail-ID">
              <TextInput value={v.kadastraleGegevens} onChange={(e) => updateVergelijkingspunt(v.id, "kadastraleGegevens", e.target.value)} />
            </Field>
            <Field label="Bouwjaar">
              <TextInput type="number" value={v.bouwjaar} onChange={(e) => updateVergelijkingspunt(v.id, "bouwjaar", e.target.value)} />
            </Field>
            <Field label="Aard van de transactie">
              <Select options={OPTS.aardTransactie} value={v.aardTransactie} onChange={(e) => updateVergelijkingspunt(v.id, "aardTransactie", e.target.value)} />
            </Field>
            <Field label="Datum transactie">
              <TextInput type="date" value={v.datumTransactie} onChange={(e) => updateVergelijkingspunt(v.id, "datumTransactie", e.target.value)} />
            </Field>
            <Field label="Soort prijs" hint="Een vraagprijs is een plafond — de onderhandelingsmarge wordt verrekend">
              <Select zonderOnbekend options={PRIJS_SOORTEN} value={v.prijsSoort || PRIJS_SOORTEN[0]} onChange={(e) => updateVergelijkingspunt(v.id, "prijsSoort", e.target.value)} />
            </Field>
            <Field label={/^Vraagprijs/.test(v.prijsSoort || "") ? "Vraagprijs (€)" : "Prijs / belastbare grondslag (€)"}>
              <TextInput type="number" value={v.belastbareGrondslag} onChange={(e) => updateVergelijkingspunt(v.id, "belastbareGrondslag", e.target.value)} />
            </Field>
            <Field label="Bewoonbare oppervlakte (m²)" hint="Nodig om per m² te vergelijken">
              <TextInput type="number" value={v.bewoonbareOpp || ""} onChange={(e) => updateVergelijkingspunt(v.id, "bewoonbareOpp", e.target.value)} />
            </Field>
            <Field label="Perceeloppervlakte (m²)">
              <TextInput type="number" value={v.grondOpp || ""} onChange={(e) => updateVergelijkingspunt(v.id, "grondOpp", e.target.value)} />
            </Field>
            <Field label="Bron" hint="Bv. notariële akte, eigen verkoopdossier, Statbel, vastgoedinfo">
              <TextInput value={v.bron || ""} onChange={(e) => updateVergelijkingspunt(v.id, "bron", e.target.value)} />
            </Field>
            <Field label="Ligging">
              <TextInput value={v.ligging} onChange={(e) => updateVergelijkingspunt(v.id, "ligging", e.target.value)} />
            </Field>
            <Field label="Bestemming">
              <TextInput value={v.bestemming} onChange={(e) => updateVergelijkingspunt(v.id, "bestemming", e.target.value)} />
            </Field>
            <Field label="Oriëntatie">
              <Select options={OPTS.orientatie} value={v.oriëntatie} onChange={(e) => updateVergelijkingspunt(v.id, "oriëntatie", e.target.value)} />
            </Field>
            <Field label="Externe afwerking">
              <TextInput value={v.externeAfwerking} onChange={(e) => updateVergelijkingspunt(v.id, "externeAfwerking", e.target.value)} />
            </Field>
            <Field label="Onderhoud">
              <TextInput value={v.onderhoud} onChange={(e) => updateVergelijkingspunt(v.id, "onderhoud", e.target.value)} />
            </Field>
            <Field label="Rooilijnbreedte (m)">
              <TextInput type="number" value={v.rooilijnbreedte} onChange={(e) => updateVergelijkingspunt(v.id, "rooilijnbreedte", e.target.value)} />
            </Field>
            <Field label="Gevelbreedte (m)">
              <TextInput type="number" value={v.gevelbreedte} onChange={(e) => updateVergelijkingspunt(v.id, "gevelbreedte", e.target.value)} />
            </Field>
            <Field label="Bebouwde oppervlakte (m²)">
              <TextInput type="number" value={v.bebouwdeOpp} onChange={(e) => updateVergelijkingspunt(v.id, "bebouwdeOpp", e.target.value)} />
            </Field>
            <Field label="Afweging t.o.v. het te schatten goed" full>
              <textarea value={v.afweging} onChange={(e) => updateVergelijkingspunt(v.id, "afweging", e.target.value)} rows={2}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </Field>
            {v2 && vergelijkend && (() => {
              const r = vgl && vgl.rijen.find((x) => x.id === v.id);
              return (
                <div className="md:col-span-2 rounded-md p-3" style={{ border: `1px solid ${LINE}`, background: ACCENT_SOFT }}>
                  <div className="text-xs mb-2" style={{ color: INK, fontWeight: 600 }}>Correcties t.o.v. dit pand (%) — negatief als de referentie béter is</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {CORRECTIES.map((c) => (
                      <Field key={c.k} label={c.label}>
                        <TextInput type="number" step="1" value={v[c.k] || ""} onChange={(e) => updateVergelijkingspunt(v.id, c.k, e.target.value)} placeholder="0" />
                      </Field>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                    <Checkbox label="Meenemen in de vergelijkingsmethode" checked={v.meetellen !== false} onChange={(val) => updateVergelijkingspunt(v.id, "meetellen", val)} />
                    <span className="font-mono text-xs" style={{ color: r && r.telt ? INK : INK_SOFT }}>
                      {!r ? "" : !r.telt ? `telt niet mee (${r.reden})`
                        : `${eur(r.prijs)}${r.vraagprijs ? ` × ${String(Math.round(r.factorMarge * 100) / 100).replace(".", ",")}` : ""}${r.factorIndex !== 1 ? ` × index ${String(Math.round(r.factorIndex * 1000) / 1000).replace(".", ",")}` : ""}${r.correctiePct ? ` × ${String(Math.round((1 + r.correctiePct / 100) * 1000) / 1000).replace(".", ",")}` : ""} = ${eur(r.gecorrigeerd)}${r.perM2 ? ` → ${eur(r.perM2)}/m² → ${eur(r.waarde)}` : ""}`}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ))}
      <button onClick={() => addVergelijkingspunt()} className="flex items-center gap-1.5 text-xs mt-1 px-3 py-1.5 rounded-lg"
        style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
        <Plus size={13} /> Vergelijkingspunt toevoegen
      </button>
    </div>
  );
}
