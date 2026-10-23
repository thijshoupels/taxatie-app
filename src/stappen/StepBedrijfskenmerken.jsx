// ----------------------------------------------------------------------------
// stappen/StepBedrijfskenmerken.jsx — wizardtabblad "Bedrijfskenmerken" (conditioneel)
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10) zonder de logica/opmaak zelf te
// wijzigen.
import { EpcVelden } from "../ui/EpcVelden.jsx";
import { bedrijfstypeVan, RICHTWAARDE_SLEUTEL } from "../domein/vastgoedtypes.js";
import { kenmerkGroepen, INSTALLATIES } from "../domein/bedrijfskenmerken.js";
import { berekenZones } from "../domein/zones.js";
import React from "react";
import { Building2, Layers, Compass, Zap } from "lucide-react";
import { OPTS, BEDRIJFS_RICHTWAARDEN, ACCENT, ACCENT_SOFT, INK } from "../constants.js";
import { Field, inputStyle, TextInput, Select, Section } from "../ui/velden.jsx";

// één kenmerk volgens de definitie in domein/bedrijfskenmerken.js
function KenmerkVeld({ v, d, set }) {
  const label = v.eenheid ? `${v.label} (${v.eenheid})` : v.label;
  let invoer;
  if (v.soort === "janee") {
    invoer = <Select options={OPTS.jaNee} value={d[v.k] || "Onbekend"} onChange={set(v.k)} />;
  } else if (v.soort === "keuze") {
    const opties = typeof v.opties === "string" ? OPTS[v.opties] || [] : v.opties;
    const huidig = d[v.k] || "";
    invoer = <Select options={!huidig || opties.includes(huidig) ? opties : [huidig, ...opties]} leeg="— kies —" value={huidig} onChange={set(v.k)} />;
  } else if (v.soort === "lang") {
    invoer = <textarea value={d[v.k] || ""} onChange={set(v.k)} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />;
  } else {
    invoer = <TextInput type={v.soort === "getal" ? "number" : "text"} value={d[v.k] ?? ""} onChange={set(v.k)} />;
  }
  return <Field label={label} hint={v.hint} full={v.full}>{invoer}</Field>;
}

// ---------- step (conditioneel, i.p.v. "Ruimte-eigenschappen"): bedrijfskenmerken ----------
// Getoond bij elk bedrijfstype (Kantoor, KMO-unit / gemengd, Industrie & logistiek, Retail, Horeca)
// i.p.v. de residentiële ruimte-checklists, die voor een magazijn, kantoorgebouw of winkelpand geen
// zinvolle invulling hebben. Volgorde: algemene kenmerken → kenmerken van het type → technische
// installaties → EPC (NR/kNR) met renovatieplicht → interne afwerking. De kenmerken per type staan
// in domein/bedrijfskenmerken.js (Belgische bronnen: aximas.com, kmoschatter.be, lacara.be;
// vlaanderen.be voor de niet-residentiële EPC-regeling).
export function StepBedrijfskenmerken({ d, set }) {
  const subtype = bedrijfstypeVan(d);
  // richtinggevende bandbreedte bij het subtype (of de algemene richting bij KMO-vastgoed, dat
  // geen subtype heeft, of bij Bedrijfsvastgoed zonder gekozen subtype) — zie BEDRIJFS_RICHTWAARDEN
  // in constants.js voor de herkomst/bronnen. Puur een hulptekst, geen berekening: het ingevulde
  // bedrag hierboven blijft steeds de eigen inschatting van de schatter-expert.
  const richting = BEDRIJFS_RICHTWAARDEN[RICHTWAARDE_SLEUTEL[subtype]] || BEDRIJFS_RICHTWAARDEN[""];
  const zonesMetBouwprijs = berekenZones(d.zones).metBouwprijs;
  return (
    <div>
      <Section title="Algemene bedrijfskenmerken" icon={Building2}>
        <Field label="Vervangingswaarde (nieuwbouw, na veroudering)" full
          hint={zonesMetBouwprijs
            ? "Wordt niet gebruikt: de kostenbenadering per functie (tabblad Afmetingen) gaat voor"
            : "Manuele inschatting door de schatter-expert — vervangt in de waardering de ABEX-woningindex, die enkel op residentieel vastgoed is gekalibreerd. Beter: een nieuwbouwprijs per functie op het tabblad Afmetingen"}>
          <TextInput type="number" value={d.bedrijfsVervangingswaarde} onChange={set("bedrijfsVervangingswaarde")} />
        </Field>
        <div className="col-span-2 rounded-lg p-3" style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}` }}>
          <div className="flex items-center gap-1.5 text-xs font-medium mb-1" style={{ color: INK }}>
            <Compass size={13} /> {richting.titel}
          </div>
          <div className="text-xs" style={{ color: INK }}>{richting.tekst}</div>
        </div>
        <Field label="Bestemmingszone"><Select options={OPTS.bedrijfsBestemmingszone} value={d.bedrijfsBestemmingszone} onChange={set("bedrijfsBestemmingszone")} /></Field>
        <Field label="Omgevingsvergunning milieu"><Select options={OPTS.bedrijfsVergunningMilieu} value={d.bedrijfsVergunningMilieu} onChange={set("bedrijfsVergunningMilieu")} /></Field>
        <Field label="Aantal parkeerplaatsen"><TextInput type="number" value={d.bedrijfsParkeerplaatsen} onChange={set("bedrijfsParkeerplaatsen")} /></Field>
        <Field label="Aantal laadkades"><TextInput type="number" value={d.bedrijfsLaadkades} onChange={set("bedrijfsLaadkades")} /></Field>
        <Field label="Omschrijving indeling & functionaliteit" full hint="Bv. 60% magazijn / 40% kantoor, showroom vooraan, ...">
          <textarea value={d.bedrijfsOmschrijvingIndeling} onChange={set("bedrijfsOmschrijvingIndeling")} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </Field>
      </Section>

      {/* kenmerken van het bedrijfstype en de technische installaties — zie domein/bedrijfskenmerken.js */}
      {kenmerkGroepen(d).map((g) => (
        <Section key={g.titel} title={g.titel} icon={g === INSTALLATIES ? Zap : Building2}>
          {g.velden.map((v) => <KenmerkVeld key={v.k} v={v} d={d} set={set} />)}
        </Section>
      ))}

      {/* EPC niet-residentieel (NR/kNR), label, score, geldigheid en renovatieplicht — zie
          ui/EpcVelden.jsx en domein/epc.js */}
      <Section title="Energieprestatie (EPC)" icon={Layers}>
        <EpcVelden d={d} set={set} />
      </Section>

      <Section title="Interne afwerking" icon={Layers}>
        <Field label="Vloerafwerking"><Select options={OPTS.bedrijfsVloerafwerking} value={d.bedrijfsVloerafwerking} onChange={set("bedrijfsVloerafwerking")} /></Field>
        <Field label="Wandafwerking" hint="Bv. gepleisterd/geschilderd, sandwichpanelen, sichtbeton"><TextInput value={d.bedrijfsWandafwerking} onChange={set("bedrijfsWandafwerking")} /></Field>
        <Field label="Plafondafwerking" hint="Bv. systeemplafond, zichtbare dakconstructie, spanplafond"><TextInput value={d.bedrijfsPlafondafwerking} onChange={set("bedrijfsPlafondafwerking")} /></Field>
      </Section>

    </div>
  );
}
