// ----------------------------------------------------------------------------
// stappen/StepInstallaties.jsx — wizardtabblad "Verwarming & installaties"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10) zonder de logica/opmaak zelf te
// wijzigen.
import React from "react";
import { Flame } from "lucide-react";
import { OPTS } from "../constants.js";
import { Field, TextInput, Select, MultiCheck, Section } from "../ui/velden.jsx";

// ---------- step 3: verwarming & installaties ----------
export function StepInstallaties({ d, set }) {
  return (
    <div>
      <Section title="Verwarming" icon={Flame}>
        <Field label="Soort" full><MultiCheck options={OPTS.verwarmingSoort} values={d.verwarmingSoort} onChange={(v) => set("verwarmingSoort")(v)} /></Field>
        <Field label="Grondstof" full><MultiCheck options={OPTS.verwarmingGrondstof} values={d.verwarmingGrondstof} onChange={(v) => set("verwarmingGrondstof")(v)} /></Field>
        <Field label="Verwarmingselementen" full><MultiCheck options={OPTS.verwarmingElementen} values={d.verwarmingElementen} onChange={(v) => set("verwarmingElementen")(v)} /></Field>
        <Field label="Merk en type ketel" full><TextInput value={d.ketelMerkType} onChange={set("ketelMerkType")} /></Field>
      </Section>
      <Section title="Warm water" icon={Flame}>
        <Field label="Warm water" full><MultiCheck options={OPTS.warmWater} values={d.warmWater} onChange={(v) => set("warmWater")(v)} /></Field>
        {d.warmWater.includes("Andere") && (
          <Field label="Omschrijving"><TextInput value={d.warmWaterAndere} onChange={set("warmWaterAndere")} /></Field>
        )}
        <Field label="Merk en type ketel" full><TextInput value={d.warmWaterKetelMerkType} onChange={set("warmWaterKetelMerkType")} /></Field>
      </Section>
      <Section title="Technische installaties" icon={Flame}>
        <Field label="Elektrische keuring"><Select options={OPTS.keuringStatus} value={d.keuringStatus} onChange={set("keuringStatus")} /></Field>
        <Field label="Dag + nacht teller"><Select options={OPTS.jaNee.slice(0, 2)} value={d.dagNachtTeller} onChange={set("dagNachtTeller")} /></Field>
        <Field label="Allerlei" full><MultiCheck options={OPTS.allerlei} values={d.allerlei} onChange={(v) => set("allerlei")(v)} /></Field>
      </Section>
    </div>
  );
}
