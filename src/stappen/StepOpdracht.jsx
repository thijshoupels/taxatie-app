// ----------------------------------------------------------------------------
// stappen/StepOpdracht.jsx — wizardtabblad "Opdracht & verkoper"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10) zonder de logica/opmaak zelf te
// wijzigen. Expliciete "import React" hieronder (net als bij kaarten.jsx/ui/velden.jsx, stap 6/7):
// dit bestand had voorheen geen eigen React-import (het erfde die van App.jsx), en dit blijft
// veilig ongeacht de klassieke of de automatische JSX-runtime.
import React, { useState, useEffect } from "react";
import { MapPin, ClipboardList, Plus, Trash2, AlertTriangle, Loader2, Users } from "lucide-react";
import { INK, INK_SOFT, PAPER_RAISED, LINE, BRASS, BRASS_SOFT, DANGER, OPTS } from "../constants.js";
import { GOOGLE_MAPS_API_KEY, buildStaticMapUrl, fetchCadgisPerceel, CadgisKaart } from "../kaarten.jsx";
import { Field, TextInput, Select, Checkbox, Section } from "../ui/velden.jsx";
import { SignaturePad } from "../ui/SignaturePad.jsx";

// ---------- step 0: opdracht & verkoper ----------
export function StepOpdracht({ d, set, addEigenaar, removeEigenaar, updateEigenaar }) {
  const [mapError, setMapError] = useState(false);
  const [cadgisLoading, setCadgisLoading] = useState(false);
  const [cadgisError, setCadgisError] = useState(false);
  const adres = `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}, België`;
  const adresVolledig = d.straat && d.gemeente;
  const mapSrc = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres)}`;
  const staticMapUrl = buildStaticMapUrl(adres);

  // zoekt automatisch de perceelsgeometrie (bbox + de buitenrand van het perceel zelf, voor de
  // markering) op zodra een CaPaKey is ingevuld of gewijzigd — het resultaat wordt in het dossier
  // bewaard (zie cadgisBbox/cadgisRingen hierboven) zodat het verslag zelf nadien geen live
  // opzoeking meer hoeft te doen.
  useEffect(() => {
    const key = (d.capakey || "").trim();
    if (!key) { setCadgisError(false); return; }
    // migratiegeval: een dossier dat zijn bbox al opzocht vóór de perceelsmarkering bestond, heeft
    // wel een cadgisCapakeyOpgezocht die al overeenkomt én een cadgisBbox, maar nog geen
    // cadgisRingen — dat moet hier alsnog (eenmalig) opnieuw opgezocht worden. Een capakey die
    // eerder gewoon niet gevonden werd (geen bbox, geen ringen) mag daarentegen niet bij elke
    // render opnieuw geprobeerd worden — vandaar de onderscheiden check hieronder i.p.v. gewoon op
    // "geen ringen" te controleren.
    const migratiegeval = d.cadgisBbox && !d.cadgisRingen?.length;
    if (key === d.cadgisCapakeyOpgezocht && !migratiegeval) return;
    let cancelled = false;
    setCadgisLoading(true); setCadgisError(false);
    fetchCadgisPerceel(key).then((perceel) => {
      if (cancelled) return;
      if (perceel) { set("cadgisBbox")(perceel.bbox); set("cadgisRingen")(perceel.ringen); set("cadgisCapakeyOpgezocht")(key); }
      else { setCadgisError(true); set("cadgisCapakeyOpgezocht")(key); }
    }).catch(() => { if (!cancelled) { setCadgisError(true); set("cadgisCapakeyOpgezocht")(key); } })
      .finally(() => { if (!cancelled) setCadgisLoading(false); });
    return () => { cancelled = true; };
  }, [d.capakey]);

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
              <Users size={15} style={{ color: BRASS }} />
              <h4 style={{ fontFamily: "Georgia, serif", fontSize: 14, color: INK, fontWeight: 500 }}>Nalatenschap — overleden persoon (Vlabel-schatting)</h4>
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
      <Section title="Adres" icon={MapPin}>
        <Field label="Straat"><TextInput value={d.straat} onChange={set("straat")} /></Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="Nummer"><TextInput value={d.nummer} onChange={set("nummer")} /></Field>
          <Field label="Bus"><TextInput value={d.bus} onChange={set("bus")} /></Field>
        </div>
        <Field label="Postcode"><TextInput value={d.postcode} onChange={set("postcode")} /></Field>
        <Field label="Gemeente"><TextInput value={d.gemeente} onChange={set("gemeente")} /></Field>
        <Field label="Dorp / gehucht"><TextInput value={d.dorpGehucht} onChange={set("dorpGehucht")} /></Field>
        <Field label="CRAB-gegevens"><TextInput value={d.crabGegevens} onChange={set("crabGegevens")} /></Field>
      </Section>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={15} style={{ color: BRASS }} />
          <h3 style={{ fontFamily: "Georgia, serif", fontSize: 16, color: INK, fontWeight: 500 }}>Kadastrale identificatie</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
          <Field label="CaPaKey" full hint="Manueel op te zoeken via geopunt.be of cadgis.be"><TextInput value={d.capakey} onChange={set("capakey")} /></Field>
        </div>
        {adresVolledig && !GOOGLE_MAPS_API_KEY && (
          <div className="rounded-lg p-4 text-xs flex items-center gap-2" style={{ border: `1px solid ${LINE}`, background: "#FBEAEA", color: DANGER }}>
            <AlertTriangle size={14} /> Geen Google Maps API-sleutel ingesteld (VITE_GOOGLE_MAPS_API_KEY) — de kaart kan hierdoor niet getoond worden, ook niet in het verslag.
          </div>
        )}
        {adresVolledig && GOOGLE_MAPS_API_KEY && !mapError && (
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
            <img src={staticMapUrl} alt={`Kaart van ${adres}`} style={{ width: "100%", display: "block" }}
              onError={() => setMapError(true)} />
            <div className="px-3 py-2 text-xs flex justify-between items-center" style={{ borderTop: `1px solid ${LINE}`, color: INK_SOFT }}>
              <span>{d.straat} {d.nummer}{d.bus ? "/" + d.bus : ""}, {d.postcode} {d.gemeente}</span>
              <a href={mapSrc} target="_blank" rel="noopener noreferrer" style={{ color: BRASS, textDecoration: "none", fontWeight: 500 }}>Open in Google Maps</a>
            </div>
          </div>
        )}
        {adresVolledig && GOOGLE_MAPS_API_KEY && mapError && (
          <div className="rounded-lg p-5 flex items-center justify-between" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: BRASS_SOFT }}>
                <MapPin size={17} style={{ color: BRASS }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: INK }}>{d.straat} {d.nummer}{d.bus ? "/" + d.bus : ""}</div>
                <div style={{ fontSize: 12, color: INK_SOFT }}>{d.postcode} {d.gemeente}</div>
              </div>
            </div>
            <a href={mapSrc} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
              style={{ background: INK, textDecoration: "none" }}>
              <MapPin size={13} /> Open kaart
            </a>
          </div>
        )}
        {!adresVolledig && (
          <div className="text-xs italic p-4 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
            Vul straat en gemeente in om de kaart te tonen.
          </div>
        )}

        <div className="text-xs mt-4 mb-2" style={{ color: INK_SOFT, fontWeight: 500 }}>Kadasterkaart (CadGIS)</div>
        {!d.capakey && (
          <div className="text-xs italic p-4 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
            Vul de CaPaKey hierboven in om de kadasterkaart te tonen.
          </div>
        )}
        {d.capakey && cadgisLoading && (
          <div className="rounded-lg p-4 text-xs flex items-center gap-2" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
            <Loader2 size={14} className="animate-spin" /> Perceel opzoeken...
          </div>
        )}
        {d.capakey && !cadgisLoading && cadgisError && (
          <div className="rounded-lg p-4 text-xs flex items-center justify-between gap-2" style={{ border: `1px solid ${LINE}`, background: "#FBEAEA", color: DANGER }}>
            <span className="flex items-center gap-2"><AlertTriangle size={14} /> Geen perceel gevonden voor deze CaPaKey — controleer de schrijfwijze (bv. "46020B0127/00Z000").</span>
            <button type="button" onClick={() => set("cadgisCapakeyOpgezocht")("")}
              className="text-xs px-2 py-1 rounded flex-shrink-0" style={{ border: `1px solid ${DANGER}`, color: DANGER, background: "transparent" }}>
              Opnieuw proberen
            </button>
          </div>
        )}
        {d.capakey && !cadgisLoading && !cadgisError && d.cadgisBbox && (
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
            <CadgisKaart bbox={d.cadgisBbox} ringen={d.cadgisRingen} />
            <div className="px-3 py-2 text-xs flex justify-between items-center" style={{ borderTop: `1px solid ${LINE}`, color: INK_SOFT }}>
              <span>CaPaKey {d.capakey}</span>
              <span>Bron: CadGIS Vlaanderen (Informatie Vlaanderen)</span>
            </div>
          </div>
        )}
      </div>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Users size={15} style={{ color: BRASS }} />
          <h3 style={{ fontFamily: "Georgia, serif", fontSize: 16, color: INK, fontWeight: 500 }}>Eigendomstoestand — zakelijke rechten</h3>
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
