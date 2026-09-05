// ----------------------------------------------------------------------------
// stappen/StepBedrijfskenmerken.jsx — wizardtabblad "Bedrijfskenmerken" (conditioneel)
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10) zonder de logica/opmaak zelf te
// wijzigen.
import React from "react";
import { Building2, Layers } from "lucide-react";
import { OPTS } from "../constants.js";
import { Field, inputStyle, TextInput, Select, Section } from "../ui/velden.jsx";

// ---------- step (conditioneel, i.p.v. "Ruimte-eigenschappen"): bedrijfskenmerken ----------
// Getoond bij vastgoedType "KMO-vastgoed" of "Bedrijfsvastgoed" (zie StepType en de steps-array
// in DossierWizard) i.p.v. de residentiële ruimte-checklists, die voor een magazijn, kantoorgebouw
// of winkelpand geen zinvolle invulling hebben. De generieke sectie geldt voor beide vastgoedtypes;
// bij "Bedrijfsvastgoed" komt daar, afhankelijk van het gekozen subtype (zie StepType), nog een
// subtype-specifieke sectie bij — op basis van de kenmerkende parameters per vastgoedcategorie
// (Belgische bronnen: aximas.com, kmoschatter.be, lacara.be voor industrieel/logistiek,
// epccertificaat.vlaanderen voor de niet-residentiële EPC-regeling hieronder).
export function StepBedrijfskenmerken({ d, set }) {
  const subtype = d.vastgoedType === "Bedrijfsvastgoed" ? d.bedrijfsSubtype : "";
  return (
    <div>
      <Section title="Algemene bedrijfskenmerken" icon={Building2}>
        <Field label="Vervangingswaarde (nieuwbouw, na veroudering)" full
          hint="Manuele inschatting door de schatter-expert — vervangt in de waardering de ABEX-woningindex, die enkel op residentieel vastgoed is gekalibreerd">
          <TextInput type="number" value={d.bedrijfsVervangingswaarde} onChange={set("bedrijfsVervangingswaarde")} />
        </Field>
        <Field label="Bestemmingszone"><Select options={OPTS.bedrijfsBestemmingszone} value={d.bedrijfsBestemmingszone} onChange={set("bedrijfsBestemmingszone")} /></Field>
        <Field label="Omgevingsvergunning milieu"><Select options={OPTS.bedrijfsVergunningMilieu} value={d.bedrijfsVergunningMilieu} onChange={set("bedrijfsVergunningMilieu")} /></Field>
        <Field label="Aantal parkeerplaatsen"><TextInput type="number" value={d.bedrijfsParkeerplaatsen} onChange={set("bedrijfsParkeerplaatsen")} /></Field>
        <Field label="Aantal laadkades"><TextInput type="number" value={d.bedrijfsLaadkades} onChange={set("bedrijfsLaadkades")} /></Field>
        <Field label="EPC-regime" hint="Niet-residentiële EPC-regeling — kies het type dat van toepassing is, of 'in onderzoek' bij twijfel over de precieze verplichting voor dit pand">
          <Select options={OPTS.bedrijfsEpcType} value={d.bedrijfsEpcType} onChange={set("bedrijfsEpcType")} />
        </Field>
        <Field label="EPC-waarde"><TextInput value={d.bedrijfsEpcWaarde} onChange={set("bedrijfsEpcWaarde")} /></Field>
        <Field label="EPC-certificaatnummer" full><TextInput value={d.bedrijfsEpcCertificaatnummer} onChange={set("bedrijfsEpcCertificaatnummer")} /></Field>
        <Field label="Omschrijving indeling & functionaliteit" full hint="Bv. 60% magazijn / 40% kantoor, showroom vooraan, ...">
          <textarea value={d.bedrijfsOmschrijvingIndeling} onChange={set("bedrijfsOmschrijvingIndeling")} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </Field>
      </Section>

      <Section title="Interne afwerking" icon={Layers}>
        <Field label="Vloerafwerking"><Select options={OPTS.bedrijfsVloerafwerking} value={d.bedrijfsVloerafwerking} onChange={set("bedrijfsVloerafwerking")} /></Field>
        <Field label="Wandafwerking" hint="Bv. gepleisterd/geschilderd, sandwichpanelen, sichtbeton"><TextInput value={d.bedrijfsWandafwerking} onChange={set("bedrijfsWandafwerking")} /></Field>
        <Field label="Plafondafwerking" hint="Bv. systeemplafond, zichtbare dakconstructie, spanplafond"><TextInput value={d.bedrijfsPlafondafwerking} onChange={set("bedrijfsPlafondafwerking")} /></Field>
      </Section>

      {subtype === "Kantoor" && (
        <Section title="Kantoor — specifieke kenmerken" icon={Building2}>
          <Field label="Indeling"><Select options={OPTS.kantoorIndeling} value={d.kantoorIndeling} onChange={set("kantoorIndeling")} /></Field>
          <Field label="Aantal verdiepingen"><TextInput type="number" value={d.kantoorVerdiepingen} onChange={set("kantoorVerdiepingen")} /></Field>
          <Field label="Lift aanwezig"><Select options={OPTS.jaNee} value={d.kantoorLiftAanwezig} onChange={set("kantoorLiftAanwezig")} /></Field>
          <Field label="Serverruimte/technisch lokaal"><Select options={OPTS.jaNee} value={d.kantoorServerruimte} onChange={set("kantoorServerruimte")} /></Field>
          <Field label="Certificering" full hint="Bv. BREEAM, WELL — indien van toepassing"><TextInput value={d.kantoorCertificering} onChange={set("kantoorCertificering")} /></Field>
        </Section>
      )}

      {subtype === "Winkel" && (
        <Section title="Winkel — specifieke kenmerken" icon={Building2}>
          <Field label="Locatiecategorie" hint="Ligging is doorgaans de belangrijkste waardebepalende factor bij een winkelpand">
            <Select options={OPTS.winkelLocatiecategorie} value={d.winkelLocatiecategorie} onChange={set("winkelLocatiecategorie")} />
          </Field>
          <Field label="Gevelbreedte (m)"><TextInput type="number" value={d.winkelGevelbreedte} onChange={set("winkelGevelbreedte")} /></Field>
          <Field label="Etalage aanwezig"><Select options={OPTS.jaNee} value={d.winkelEtalage} onChange={set("winkelEtalage")} /></Field>
          <Field label="Magazijn/opslag achteraan"><Select options={OPTS.jaNee} value={d.winkelMagazijnAchteraan} onChange={set("winkelMagazijnAchteraan")} /></Field>
          <Field label="Inschatting voetgangersfrequentie" full><TextInput value={d.winkelPasanten} onChange={set("winkelPasanten")} placeholder="bv. druk, gemiddeld, rustig" /></Field>
        </Section>
      )}

      {subtype === "Industrieel/logistiek" && (
        <Section title="Industrieel/logistiek — specifieke kenmerken" icon={Building2}>
          <Field label="Vrije hoogte (m)" hint="Onder dak/kraanbaan"><TextInput type="number" value={d.industrieelVrijeHoogte} onChange={set("industrieelVrijeHoogte")} /></Field>
          <Field label="Vloerbelasting (ton/m²)"><TextInput type="number" value={d.industrieelVloerbelasting} onChange={set("industrieelVloerbelasting")} /></Field>
          <Field label="Aantal dock levellers"><TextInput type="number" value={d.industrieelAantalDockLevellers} onChange={set("industrieelAantalDockLevellers")} /></Field>
          <Field label="Elektrisch vermogen" hint="Bv. in kVA"><TextInput value={d.industrieelElektrischVermogen} onChange={set("industrieelElektrischVermogen")} /></Field>
          <Field label="Deelbaarheid" full hint="Bv. deelbaar vanaf 500 m² voor meerdere huurders"><TextInput value={d.industrieelDeelbaarheid} onChange={set("industrieelDeelbaarheid")} /></Field>
        </Section>
      )}

      {subtype === "Horeca" && (
        <Section title="Horeca — specifieke kenmerken" icon={Building2}>
          <Field label="Type horecazaak"><Select options={OPTS.horecaType} value={d.horecaType} onChange={set("horecaType")} /></Field>
          <Field label="Uitbatingsvergunning aanwezig"><Select options={OPTS.jaNee} value={d.horecaVergunningUitbating} onChange={set("horecaVergunningUitbating")} /></Field>
          <Field label="Terras aanwezig"><Select options={OPTS.jaNee} value={d.horecaTerras} onChange={set("horecaTerras")} /></Field>
          <Field label="Aantal zitplaatsen"><TextInput type="number" value={d.horecaZitplaatsen} onChange={set("horecaZitplaatsen")} /></Field>
          <Field label="Keukenuitrusting" full><TextInput value={d.horecaKeukenuitrusting} onChange={set("horecaKeukenuitrusting")} /></Field>
        </Section>
      )}
    </div>
  );
}
