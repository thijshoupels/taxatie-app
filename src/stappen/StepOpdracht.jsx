// ----------------------------------------------------------------------------
// stappen/StepOpdracht.jsx — wizardtabblad "Opdracht & verkoper"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10) zonder de logica/opmaak zelf te
// wijzigen. Expliciete "import React" hieronder (net als bij kaarten.jsx/ui/velden.jsx, stap 6/7):
// dit bestand had voorheen geen eigen React-import (het erfde die van App.jsx), en dit blijft
// veilig ongeacht de klassieke of de automatische JSX-runtime.
import React, { useEffect } from "react";
import { MapPin, ClipboardList, Plus, Trash2, Users } from "lucide-react";
import { INK, INK_SOFT, PAPER_RAISED, LINE, ACCENT, DANGER, OPTS, SANS } from "../constants.js";
import { Field, TextInput, Select, Checkbox, Section } from "../ui/velden.jsx";
import { SignaturePad } from "../ui/SignaturePad.jsx";

// ---------- step 0: opdracht & verkoper ----------
export function StepOpdracht({ d, set, addEigenaar, removeEigenaar, updateEigenaar }) {
  // pandadres zonder ", België" — het formaat dat in het verslag zelf gebruikt wordt, zie ook
  // buildReportData's "adres"-opbouw
  const pandAdresKort = `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}`.trim();

  // "zelfde als"-vlaggen automatisch doorvoeren: zo moet de gebruiker adres/naam niet meermaals
  // intypen wanneer opdrachtgever, verkoper en/of eigenaar in werkelijkheid dezelfde persoon of
  // hetzelfde adres betreffen — zie ook de checkboxen verderop in deze stap.
  useEffect(() => {
    if (d.opdrachtgeverAdresZelfde && d.opdrachtgeverAdres !== pandAdresKort) set("opdrachtgeverAdres")(pandAdresKort);
  }, [d.opdrachtgeverAdresZelfde, pandAdresKort]);
  useEffect(() => {
    if (d.verkoperAdresZelfde && d.verkoperAdres !== pandAdresKort) set("verkoperAdres")(pandAdresKort);
  }, [d.verkoperAdresZelfde, pandAdresKort]);
  useEffect(() => {
    if (!d.opdrachtgeverIsEigenaar) return;
    if (d.eigenaars.length === 0) { addEigenaar(); return; }
    if (d.eigenaars[0].naam !== d.opdrachtgeverNaam) updateEigenaar(d.eigenaars[0].id, "naam", d.opdrachtgeverNaam);
  }, [d.opdrachtgeverIsEigenaar, d.opdrachtgeverNaam, d.eigenaars]);

  return (
    <div>
      <Section title="Identificatie schatter-expert" icon={ClipboardList}>
        <Field label="Naam schatter-expert"><TextInput value={d.schatterNaam} onChange={set("schatterNaam")} /></Field>
        <Field label="(Beroeps)titel"><TextInput value={d.schatterTitel} onChange={set("schatterTitel")} /></Field>
        <Field label="Vlabel-identificatienummer" hint="Door de Vlaamse Belastingdienst toegekend identificatienummer voor schatters-experten">
          <TextInput value={d.schatterVlabelNummer} onChange={set("schatterVlabelNummer")} />
        </Field>
        <Field label="BIV-nummer" hint="Erkenningsnummer bij het Beroepsinstituut van Vastgoedmakelaars">
          <TextInput value={d.schatterBivNummer} onChange={set("schatterBivNummer")} />
        </Field>
        <Field label="Telefoon schatter-expert"><TextInput value={d.schatterTelefoon} onChange={set("schatterTelefoon")} /></Field>
        <Field label="Handtekening" full hint="Verschijnt bij de eedformule onderaan het verslag">
          <SignaturePad value={d.handtekening} onChange={set("handtekening")} />
        </Field>
      </Section>
      <Section title="Opdracht" icon={ClipboardList}>
        <Field label="Opdrachtgever (naam of benaming)"><TextInput value={d.opdrachtgeverNaam} onChange={set("opdrachtgeverNaam")} /></Field>
        <div>
          <span className="block text-xs mb-1" style={{ color: INK_SOFT, fontWeight: 500 }}>Adres opdrachtgever</span>
          <TextInput value={d.opdrachtgeverAdres} onChange={set("opdrachtgeverAdres")} disabled={d.opdrachtgeverAdresZelfde} />
          <Checkbox label="Zelfde als adres pand" checked={d.opdrachtgeverAdresZelfde} onChange={set("opdrachtgeverAdresZelfde")} />
        </div>
        <Field label="Rijksregisternummer / ondernemingsnummer"><TextInput value={d.opdrachtgeverIdNummer} onChange={set("opdrachtgeverIdNummer")} /></Field>
        <Field label="Wettelijke vertegenwoordiger" hint="Indien opdrachtgevende overheidsinstantie"><TextInput value={d.opdrachtgeverVertegenwoordiger} onChange={set("opdrachtgeverVertegenwoordiger")} /></Field>
        <Field label="Reden van waardering"><Select options={OPTS.reden} value={d.reden} onChange={set("reden")} /></Field>
        <Field label="Opdrachtgever aanwezig bij bezoek"><Select options={OPTS.jaNee.slice(0, 2)} value={d.opdrachtgeverAanwezig} onChange={set("opdrachtgeverAanwezig")} /></Field>
        <Field label="Datum plaatsbezoek"><TextInput type="date" value={d.datumBezoek} onChange={set("datumBezoek")} /></Field>
        <Field label="Datum verslag"><TextInput type="date" value={d.datumVerslag} onChange={set("datumVerslag")} /></Field>
        {/* stond voordien vast in de code ("Beveren"), waardoor élk verslag met die plaats afsloot,
            ook een schatting elders */}
        <Field label="Plaats eedformule" hint='Verschijnt onderaan het verslag als "Gedaan te …"'>
          <TextInput value={d.eedPlaats} onChange={set("eedPlaats")} />
        </Field>
        {d.reden !== "Nalatenschap" && (
          <Field label="Referentiedatum schatting" full
            hint="Datum waarop de waarde van het onroerend goed wordt bepaald">
            <TextInput type="date" value={d.referentiedatum} onChange={set("referentiedatum")} />
          </Field>
        )}
        {d.reden === "Nalatenschap" && (
          <div className="col-span-2 rounded-lg p-4" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
            <div className="flex items-center gap-2 mb-3">
              <Users size={15} style={{ color: ACCENT }} />
              <h4 style={{ fontFamily: SANS, fontSize: 14, color: INK, fontWeight: 500 }}>Nalatenschap — overleden persoon (Vlabel-schatting)</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Naam overleden persoon"><TextInput value={d.overledenNaam} onChange={set("overledenNaam")} /></Field>
              <Field label="Rijksregisternummer overleden persoon"><TextInput value={d.overledenRijksregisternummer} onChange={set("overledenRijksregisternummer")} /></Field>
              <Field label="Dossiernummer Vlabel"><TextInput value={d.vlabelDossiernummer} onChange={set("vlabelDossiernummer")} /></Field>
              <Field label="Datum overlijden (referentiedatum)" hint="Datum waarop de waarde van het onroerend goed wordt bepaald">
                <TextInput type="date" value={d.referentiedatum} onChange={set("referentiedatum")} />
              </Field>
            </div>
          </div>
        )}
      </Section>
      <Section title="Contactgegevens verkoper" icon={Users}>
        <Field label="Naam"><TextInput value={d.verkoperNaam} onChange={set("verkoperNaam")} /></Field>
        <div>
          <span className="block text-xs mb-1" style={{ color: INK_SOFT, fontWeight: 500 }}>Adres</span>
          <TextInput value={d.verkoperAdres} onChange={set("verkoperAdres")} disabled={d.verkoperAdresZelfde} />
          <Checkbox label="Zelfde als adres pand" checked={d.verkoperAdresZelfde} onChange={set("verkoperAdresZelfde")} />
        </div>
        <Field label="Telefoonnummer"><TextInput value={d.verkoperTelefoon} onChange={set("verkoperTelefoon")} /></Field>
        <Field label="E-mail"><TextInput type="email" value={d.verkoperEmail} onChange={set("verkoperEmail")} /></Field>
      </Section>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={15} style={{ color: ACCENT }} />
          <h3 style={{ fontFamily: SANS, fontSize: 16, color: INK, fontWeight: 500 }}>Adres en kadaster</h3>
        </div>
        <div className="text-xs italic p-4 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT, lineHeight: 1.6 }}>
          Het adres, de CaPaKey en beide kaarten vul je in op het tabblad "Type, staat &amp; kadaster".
          Die gegevens horen namelijk bij één welbepaald pand: bevat dit dossier meerdere panden, dan
          heeft elk pand daar zijn eigen adres en perceel. Dit tabblad blijft voor wat voor het hele
          dossier geldt — opdrachtgever, verkoper, reden van waardering en schatter-expert.
        </div>
      </div>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Users size={15} style={{ color: ACCENT }} />
          <h3 style={{ fontFamily: SANS, fontSize: 16, color: INK, fontWeight: 500 }}>Eigendomstoestand — zakelijke rechten</h3>
        </div>
        <div className="text-xs mb-2" style={{ color: INK_SOFT }}>Elke houder van een zakelijk recht, met zijn aandeel (quotiteit) in de volledige eigendom.</div>
        <Checkbox label="Eigenaar(s) = opdrachtgever" checked={d.opdrachtgeverIsEigenaar} onChange={set("opdrachtgeverIsEigenaar")} />
        <div className="flex flex-col gap-2 mt-1">
          {d.eigenaars.map((e, i) => (
            <div key={e.id} className="grid gap-2 items-center" style={{ gridTemplateColumns: "1fr 1fr 120px 32px" }}>
              <TextInput placeholder="Naam" value={e.naam} onChange={(ev) => updateEigenaar(e.id, "naam", ev.target.value)}
                disabled={i === 0 && d.opdrachtgeverIsEigenaar} />
              <Select options={OPTS.recht} value={e.recht} onChange={(ev) => updateEigenaar(e.id, "recht", ev.target.value)} />
              <TextInput placeholder="Aandeel (bv. 1/2)" value={e.aandeel} onChange={(ev) => updateEigenaar(e.id, "aandeel", ev.target.value)} />
              <button onClick={() => removeEigenaar(e.id)}><Trash2 size={14} style={{ color: DANGER }} /></button>
            </div>
          ))}
        </div>
        <button onClick={addEigenaar} className="flex items-center gap-1.5 text-xs mt-2 px-3 py-1.5 rounded-lg"
          style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
          <Plus size={13} /> Rechthebbende toevoegen
        </button>
      </div>
    </div>
  );
}
