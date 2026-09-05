// ----------------------------------------------------------------------------
// stappen/StepVergelijkingspunten.jsx — wizardtabblad "Vergelijkingspunten & waarderingsmethode"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10) zonder de logica/opmaak zelf te
// wijzigen.
import React from "react";
import { Ruler, Trash2, Plus } from "lucide-react";
import { OPTS, LINE, PAPER_RAISED, BRASS_SOFT, BRASS, DANGER, INK_SOFT } from "../constants.js";
import { Section, Field, TextInput, Select, inputStyle } from "../ui/velden.jsx";

// ---------- vergelijkingspunten & waarderingsmethode ----------
export function StepVergelijkingspunten({ d, set, addVergelijkingspunt, removeVergelijkingspunt, updateVergelijkingspunt }) {
  const vergelijkend = d.wijzeVanWaardering === "Vergelijkende methode";
  return (
    <div>
      <Section title="Wijze van waardering" icon={Ruler}>
        <Field label="Methode" hint="Vergelijkende methode is de regel; analytische/redelijke methode enkel bij ontbreken van directe vergelijkingspunten, gemotiveerd">
          <Select options={OPTS.wijzeVanWaardering} value={d.wijzeVanWaardering} onChange={set("wijzeVanWaardering")} />
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
      <div className="text-xs mb-4 p-3 rounded-lg" style={{ background: BRASS_SOFT, color: BRASS }}>
        {d.reden === "Nalatenschap" && vergelijkend
          ? "Let op: bij een nalatenschap met de vergelijkende methode worden deze VGL-punten volledig in het verslag opgenomen (adres, kadastrale gegevens, transactiegegevens en afweging) — dat is een Vlabel-vereiste. Vul ze dus in met de wetenschap dat ze meegaan naar de opdrachtgever en naar Vlabel."
          : "VGL-punten worden hier intern bijgehouden ter staving van de waardering; in dit dossier verschijnt enkel het aantal in het verslag, niet de gegevens zelf."}
      </div>

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
            <Field label="Belastbare grondslag (€)">
              <TextInput type="number" value={v.belastbareGrondslag} onChange={(e) => updateVergelijkingspunt(v.id, "belastbareGrondslag", e.target.value)} />
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
          </div>
        </div>
      ))}
      <button onClick={addVergelijkingspunt} className="flex items-center gap-1.5 text-xs mt-1 px-3 py-1.5 rounded-lg"
        style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
        <Plus size={13} /> Vergelijkingspunt toevoegen
      </button>
    </div>
  );
}
