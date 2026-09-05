// ----------------------------------------------------------------------------
// stappen/StepConstructie.jsx — wizardtabblad "Constructie & isolatie"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10) zonder de logica/opmaak zelf te
// wijzigen.
import React from "react";
import { Layers } from "lucide-react";
import { BRASS, OPTS } from "../constants.js";
import { Field, TextInput, Select, QuickChips, MultiCheck, Section } from "../ui/velden.jsx";

// ---------- step 2: constructie & isolatie ----------
export function StepConstructie({ d, set }) {
  // "EPC" hieronder (kWh/m²) is de residentiële berekeningswijze — bij KMO-vastgoed/
  // Bedrijfsvastgoed geldt een ander EPC-regime (kNR/NR, zie epccertificaat.vlaanderen), dat al
  // apart op het tabblad "Bedrijfskenmerken" wordt bevraagd (bedrijfsEpcType) — vandaar hier
  // verborgen i.p.v. dubbele/tegenstrijdige EPC-gegevens te riskeren. De isolatiematerialen
  // zelf (dakisolatie, spouwmuur, ...) blijven wél voor elk vastgoedtype relevant.
  const isResidentieel = d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed";
  return (
    <div>
      <Section title="Ruwbouw en vloerplaat" icon={Layers}>
        <Field label="Ruwbouw"><Select options={OPTS.ruwbouw} value={d.ruwbouw} onChange={set("ruwbouw")} /></Field>
        {d.ruwbouw === "Andere" && (
          <Field label="Omschrijving"><TextInput value={d.ruwbouwAndere} onChange={set("ruwbouwAndere")} /></Field>
        )}
        <Field label="Voorgevel">
          <TextInput value={d.voorgevel} onChange={set("voorgevel")} placeholder="bv. gemetste gevelsteen" />
          <QuickChips options={OPTS.gevelmateriaal} onPick={(v) => set("voorgevel")(v)} />
        </Field>
        <Field label="Zijgevel">
          <TextInput value={d.zijgevel} onChange={set("zijgevel")} />
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <QuickChips options={OPTS.gevelmateriaal} onPick={(v) => set("zijgevel")(v)} />
            {d.voorgevel && (
              <button type="button" onClick={() => set("zijgevel")(d.voorgevel)}
                className="text-xs underline mt-1.5" style={{ color: BRASS }}>
                zelfde als voorgevel
              </button>
            )}
          </div>
        </Field>
        <Field label="Achtergevel">
          <TextInput value={d.achtergevel} onChange={set("achtergevel")} />
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <QuickChips options={OPTS.gevelmateriaal} onPick={(v) => set("achtergevel")(v)} />
            {d.voorgevel && (
              <button type="button" onClick={() => set("achtergevel")(d.voorgevel)}
                className="text-xs underline mt-1.5" style={{ color: BRASS }}>
                zelfde als voorgevel
              </button>
            )}
          </div>
        </Field>
        <Field label="Materiaalkwaliteit muren & plafonds" full hint="Vlabel-kwaliteitseis: type constructie en gebruikte materialen — vloeren komen aan bod bij 'Bouwlaag'">
          <TextInput value={d.materiaalkwaliteitOmschrijving} onChange={set("materiaalkwaliteitOmschrijving")} placeholder="bv. binnenmuren gepleisterd, plafonds gipskarton geschilderd" />
        </Field>
      </Section>
      <Section title="Dak" icon={Layers}>
        <Field label="Hoofddak"><Select options={OPTS.hoofddakType} value={d.hoofddakType} onChange={set("hoofddakType")} /></Field>
        <Field label="Materiaal hoofddak"><Select options={OPTS.hoofddakMateriaal} value={d.hoofddakMateriaal} onChange={set("hoofddakMateriaal")} /></Field>
        <Field label="Constructie & materiaal bijgebouw" full>
          <TextInput value={d.bijgebouwConstructie} onChange={set("bijgebouwConstructie")} placeholder="bv. Beton" />
          <QuickChips options={OPTS.bijgebouwConstructieType} onPick={(v) => set("bijgebouwConstructie")(v)} />
        </Field>
      </Section>
      <Section title="Isolatie" icon={Layers}>
        {isResidentieel && (
          <>
            <Field label="EPC"><Select options={OPTS.epcStatus} value={d.epcStatus} onChange={set("epcStatus")} /></Field>
            <Field label="EPC-waarde (kWh/m²)"><TextInput type="number" value={d.epcWaarde} onChange={set("epcWaarde")} /></Field>
            <Field label="EPC-certificaatnummer" full><TextInput value={d.epcCertificaatnummer} onChange={set("epcCertificaatnummer")} /></Field>
          </>
        )}
        <Field label="Isolatie" full>
          <MultiCheck options={OPTS.isolatie} values={d.isolatie} onChange={(v) => set("isolatie")(v)} />
        </Field>
      </Section>
      <Section title="Buitenschrijnwerk" icon={Layers}>
        <Field label="Buitenschrijnwerk" full>
          <MultiCheck options={OPTS.buitenschrijnwerk} values={d.buitenschrijnwerk} onChange={(v) => set("buitenschrijnwerk")(v)} />
        </Field>
      </Section>
    </div>
  );
}
