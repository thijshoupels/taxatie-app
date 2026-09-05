// ----------------------------------------------------------------------------
// rapport/StepRapport.jsx — rapport-voorvertoning (scherm) + PDF-downloadlogica
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 9) zonder de logica/opmaak zelf te
// wijzigen: Page/ReportH/ReportGrid/ReportList/RoomBlock zijn de kleine, herbruikbare
// weergave-bouwstenen voor de on-scherm voorvertoning (los van de gelijknamige, maar zelfstandige
// Word-veilige bouwstenen in rapport/html.js, die enkel voor de gedownloade PDF/HTML dienen);
// StepRapport zelf is het laatste wizardtabblad, met zowel de voorvertoning als de
// "Download PDF"-knop (handlePrintPdf).
import React, { useState, useRef, useContext } from "react";
import { AlertTriangle } from "lucide-react";
import {
  INK, INK_SOFT, PAPER_RAISED, LINE, BRASS, BRASS_SOFT, STAMP, STAMP_SOFT, DANGER,
  HUISSTIJLEN, HuisstijlContext, VERDIEPINGEN, RUIMTE_CHECKLISTS,
} from "../constants.js";
import { num, eur, nlDate, dash, joinOrDash, unit, isEmptyVal } from "../lib/format.js";
import {
  rapportVergelijkingspuntRijen, rapportWaarderingsBlokken, rapportVenaleWaardeZin,
} from "../domein/waardering.js";
import { supabase, haalSessieToken } from "../data/supabase.js";
import { uploadFotoVoorPdf } from "../data/ai.js";
import { GOOGLE_MAPS_API_KEY, buildStaticMapUrl, CadgisKaart } from "../kaarten.jsx";
import { voorafgaandeOpmerkingen } from "./html.js";
import { buildPrintHtml } from "./bouwers.js";
// valideerDossier blijft (voorlopig) in App.jsx staan (zie AI_VELDEN/bouwAiVoorstellen aldaar) —
// deze terugimport naar App.jsx is een bewuste, in ES-modules onschuldige circulaire import:
// valideerDossier is een module-brede function declaration (gehesen vóór enige module-code
// uitvoert), dus de binding staat al klaar tegen de tijd dat StepRapport() ze effectief aanroept
// (bij een render, ruim na het laden van beide modules) — bevestigd met een Node-test op de
// gebundelde uitvoer (zie __tests__/stap9).
import { valideerDossier } from "../App.jsx";

export function Page({ n, total, children, noFooter, huisstijl }) {
  const hs = huisstijl || HUISSTIJLEN.houpels;
  return (
    <div className="rounded-lg mb-6 report-page" style={{ background: PAPER_RAISED, border: `1px solid ${LINE}`, fontFamily: "Georgia, serif", boxShadow: "0 1px 2px rgba(0,0,0,0.03)", position: "relative", minHeight: "261mm" }}>
      <div className="p-8" style={{ paddingBottom: noFooter ? 32 : 68 }}>{children}</div>
      {!noFooter && (
        <div className="flex justify-between items-center px-8 py-3 text-xs"
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, borderTop: `1px dotted ${LINE}`, color: INK_SOFT, fontFamily: "system-ui", background: PAPER_RAISED }}>
          <span>{hs.naam}</span>
          <span>Pagina {n} van {total}</span>
        </div>
      )}
    </div>
  );
}
export function ReportH({ children }) {
  const hs = useContext(HuisstijlContext);
  return <h2 style={{ fontSize: 13, fontWeight: 600, color: hs.kleur, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 16, marginBottom: 8, fontFamily: "Arial, sans-serif" }}>{children}</h2>;
}
export function ReportGrid({ rows }) {
  const filled = rows.filter(([, v]) => !isEmptyVal(v));
  if (filled.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mb-2" style={{ fontFamily: "system-ui", fontSize: 15 }}>
      {filled.map(([k, v], i) => (
        <div key={k + i} className="flex justify-between" style={{ borderBottom: `1px dotted ${LINE}`, paddingBottom: 4, gap: 12 }}>
          <span style={{ color: INK_SOFT, flexShrink: 0 }}>{k}</span>
          <span style={{ textAlign: "right", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}
export function ReportList({ title, items }) {
  if (items.length === 0) return null;
  return (
    <div style={{ fontSize: 15 }}>
      <div className="font-medium mb-1">{title}</div>
      <ul className="list-disc pl-5" style={{ color: INK_SOFT, lineHeight: 1.7 }}>{items.map((it, i) => <li key={i} className="mb-0.5">{it}</li>)}</ul>
    </div>
  );
}
export function RoomBlock({ label, room, cfg }) {
  if (!room) return null;
  const hasContent = room.vloer || room.items.length || room.andere || room.merken || room.aantal || room.orientatie || room.type?.length;
  if (!hasContent) return null;
  const overigeItems = cfg?.optGroups ? room.items.filter((it) => !cfg.optGroups.some((g) => g.opts.includes(it))) : room.items;
  return (
    <div className="mb-3">
      <div className="font-medium mb-1" style={{ fontFamily: "system-ui", fontSize: 15 }}>{label}</div>
      <div style={{ color: INK_SOFT, fontFamily: "system-ui", fontSize: 15, lineHeight: 1.7 }}>
        {room.type?.length > 0 && <div>Type: {room.type.join(", ")}</div>}
        {room.vloer && <div>Vloer: {room.vloer}</div>}
        {room.aantal && <div>Aantal: {room.aantal}</div>}
        {room.orientatie && <div>Oriëntatie: {room.orientatie}</div>}
        {cfg?.optGroups ? (
          cfg.optGroups.map((g) => {
            const sel = room.items.filter((it) => g.opts.includes(it));
            return sel.length > 0 ? <div key={g.key}>{g.label}: {sel.join(", ")}</div> : null;
          })
        ) : (
          room.items.length > 0 && <div>{room.items.join(", ")}</div>
        )}
        {cfg?.optGroups && overigeItems.length > 0 && <div>{overigeItems.join(", ")}</div>}
        {room.merken && <div>Merken: {room.merken}</div>}
        {room.andere && <div>Andere: {room.andere}</div>}
      </div>
    </div>
  );
}

// ---------- rapport preview ----------
export function StepRapport({ d, calc, huisstijl }) {
  const hs = huisstijl || HUISSTIJLEN.houpels;
  const bullets = (text) => text.split("\n").map((l) => l.trim()).filter(Boolean);
  const eig = d.eigenschappen;
  const isResidentieel = d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed";
  const bedrijfsSubtype = d.vastgoedType === "Bedrijfsvastgoed" ? d.bedrijfsSubtype : "";
  const adres = `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}`;
  const reportRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  // controle vóór aflevering — zie valideerDossier hierboven
  const controle = valideerDossier(d);

  // content pages (elk item = 1 pagina), na voorblad + voorafgaande opmerkingen + inhoudstafel
  const contentPages = [
    {
      title: "Opdracht & partijen",
      body: (
        <>
          <ReportH>Identificatie schatter-expert</ReportH>
          <ReportGrid rows={[
            ["Naam", dash(d.schatterNaam)], ["Titel", dash(d.schatterTitel)],
            ["BIV-nummer", dash(d.schatterBivNummer)],
            ["Vlabel-identificatienummer", dash(d.schatterVlabelNummer)],
            ["Telefoon", dash(d.schatterTelefoon)],
          ]} />
          <ReportH>Opdracht</ReportH>
          <ReportGrid rows={[
            ["Opdrachtgever", dash(d.opdrachtgeverNaam)], ["Adres opdrachtgever", dash(d.opdrachtgeverAdres)],
            ["Rijksregister-/ondernemingsnummer", dash(d.opdrachtgeverIdNummer)],
            ["Wettelijke vertegenwoordiger", dash(d.opdrachtgeverVertegenwoordiger)],
            ["Reden van waardering", d.reden], ["Opdrachtgever aanwezig", d.opdrachtgeverAanwezig],
            ["Datum plaatsbezoek", nlDate(dash(d.datumBezoek))], ["Datum verslag", nlDate(dash(d.datumVerslag))],
            [d.reden === "Nalatenschap" ? "Referentiedatum (overlijden)" : "Referentiedatum schatting", nlDate(dash(d.referentiedatum))],
          ]} />
          {d.reden === "Nalatenschap" && (
            <>
              <ReportH>Nalatenschap — overleden persoon</ReportH>
              <ReportGrid rows={[
                ["Naam overleden persoon", dash(d.overledenNaam)],
                ["Rijksregisternummer overleden persoon", dash(d.overledenRijksregisternummer)],
                ["Dossiernummer Vlabel", dash(d.vlabelDossiernummer)],
                ["Datum overlijden", nlDate(dash(d.referentiedatum))],
              ]} />
            </>
          )}
          <ReportH>Contactgegevens verkoper</ReportH>
          <ReportGrid rows={[
            ["Naam", dash(d.verkoperNaam)], ["Adres", dash(d.verkoperAdres)],
            ["Telefoon", dash(d.verkoperTelefoon)], ["E-mail", dash(d.verkoperEmail)],
          ]} />
          {d.gebruik === "Verhuurd" && (
            <>
              <ReportH>Huurder</ReportH>
              <ReportGrid rows={[
                ["Naam", dash(d.huurderNaam)], ["Telefoon", dash(d.huurderTelefoon)],
                ["E-mail", dash(d.huurderEmail)], ["Huurprijs", dash(d.huurderHuurprijs)],
                ["Type huurcontract", dash(d.huurderContractType)], ["Duurtijd", dash(d.huurderDuurtijd)],
                ...(!isResidentieel ? [
                  ["Aanvangsdatum huurovereenkomst", nlDate(dash(d.huurderAanvangsdatum))],
                  ["Eerstvolgende opzegmogelijkheid", dash(d.huurderEersteOpzegmogelijkheid)],
                  ["Hernieuwingsrecht", d.huurderHernieuwingsrecht !== "Onbekend" ? d.huurderHernieuwingsrecht : "—"],
                  ["Indexatie", dash(d.huurderIndexatie)], ["Huurwaarborg", dash(d.huurderWaarborg)],
                  ["Bijzonderheden opzegtermijn/-beding", dash(d.huurderOpzegtermijnBijzonderheden)],
                ] : []),
              ]} />
            </>
          )}
        </>
      ),
    },
    {
      title: "Aard en ligging",
      body: (
        <>
          <ReportH>Adres & kadaster</ReportH>
          <ReportGrid rows={[
            ["Adres", adres], ["Dorp/gehucht", dash(d.dorpGehucht)], ["CaPaKey", dash(d.capakey)],
            ["Kadastrale afdeling", dash(d.kadAfdeling)], ["Kadastrale sectie", dash(d.kadSectie)],
            ["Perceelnummer", dash(d.kadPerceelnummer)], ["Partitienummer", dash(d.kadPartitienummer)],
            ["Kadastrale oppervlakte", d.kadastraleOpp ? `${d.kadastraleOpp} m²` : "—"],
            ["KI", dash(d.ki)], ["Onroerende voorheffing", dash(d.onroerendeVoorheffing)],
            ["Detail privatieve eigendom", dash(d.kadDetailPrivatief)],
          ]} />
          {d.straat && d.gemeente && GOOGLE_MAPS_API_KEY && (
            <img src={buildStaticMapUrl(adres + ", België")} alt="Liggingskaart"
              style={{ width: "100%", maxWidth: 520, display: "block", border: `1px solid ${LINE}`, borderRadius: 4, marginBottom: 16 }} />
          )}
          {d.cadgisBbox && (
            <CadgisKaart bbox={d.cadgisBbox} ringen={d.cadgisRingen}
              style={{ maxWidth: 520, border: `1px solid ${LINE}`, borderRadius: 4, marginBottom: 16 }} />
          )}
          {d.eigenaars.filter((e) => e.naam).length > 0 && (
            <>
              <ReportH>Eigendomstoestand — zakelijke rechten</ReportH>
              <ReportGrid rows={d.eigenaars.filter((e) => e.naam).map((e) => [e.naam, `${e.recht}${e.aandeel ? " — " + e.aandeel : ""}`])} />
            </>
          )}
          <ReportH>Type onroerend goed</ReportH>
          <ReportGrid rows={[
            ["Vastgoedtype", d.vastgoedType + (d.vastgoedType === "Bedrijfsvastgoed" && d.bedrijfsSubtype ? ` — ${d.bedrijfsSubtype}` : "")],
            ["Pand", d.pandType], ["Aard", dash(d.aardWoning)], ["Bouwtype", d.bouwtype], ["Verdieping(en)", dash(d.verdiepingen)],
            ["Lift", d.lift], ["Bouwjaar", dash(d.bouwjaar)], ["Renovatiejaar", dash(d.renovatiejaar)],
            ["Jaar van aankoop", dash(d.jaarVanAankoop)], ["Staat", joinOrDash(d.staat)],
          ]} />
        </>
      ),
    },
    {
      title: "Ligging, omgeving & terrein",
      body: (
        <>
          {(d.omgevingsvoorzieningen || d.bereikbaarheid || d.straatuitrusting || d.bpaRupVerkaveling) && (
            <>
              <ReportH>Ligging in de omgeving</ReportH>
              {d.omgevingsvoorzieningen && (
                <div className="text-sm mb-3" style={{ fontFamily: "system-ui", color: INK_SOFT, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  <strong style={{ color: INK }}>Voorzieningen: </strong>{d.omgevingsvoorzieningen}
                </div>
              )}
              {d.bereikbaarheid && (
                <div className="text-sm mb-3" style={{ fontFamily: "system-ui", color: INK_SOFT, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  <strong style={{ color: INK }}>Bereikbaarheid: </strong>{d.bereikbaarheid}
                </div>
              )}
              {d.straatuitrusting && (
                <div className="text-sm mb-3" style={{ fontFamily: "system-ui", color: INK_SOFT, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  <strong style={{ color: INK }}>Toestand & uitrusting van de straat: </strong>{d.straatuitrusting}
                </div>
              )}
              <ReportGrid rows={[
                ["Stedenbouwkundige voorschriften", dash(d.bpaRupVerkaveling)],
              ]} />
            </>
          )}
          <ReportH>Terrein & inplanting</ReportH>
          <ReportGrid rows={[
            ["Vorm van het perceel", dash(d.vormPerceel)], ["Rooilijnbreedte", unit(d.rooilijnbreedte, "m")],
            ["Relatieve hoogteligging", d.hoogteligging],
            ["Bodemoccupatie", (d.bodemoccupatie && Number(d.bodemoccupatie) !== 0) ? unit(d.bodemoccupatie, "%") : "—"],
            ["Aantal bijgebouwen", dash(d.aantalBijgebouwen)], ["Inplanting op het terrein", dash(d.inplanting)],
          ]} />
        </>
      ),
    },
    {
      title: "Afmetingen & indeling",
      body: (
        <>
          <ReportH>Afmetingen</ReportH>
          <ReportGrid rows={[
            ["Gevelbreedte", unit(d.breedteGevel, "m")], ["Perceelbreedte", unit(d.breedtePerceel, "m")],
            ["Grondoppervlakte", unit(d.grondopp, "m²")], ["Bebouwde oppervlakte", unit(d.bebouwdeOpp, "m²")],
            [`${isResidentieel ? "Bewoonbare" : "Nuttige vloer"} oppervlakte (schatting)`, unit(d.bewoonbareOppSchatting, "m²")],
            [`${isResidentieel ? "Bewoonbare" : "Nuttige vloer"} oppervlakte (berekend)`, `${calc.totOppNaCoeff.toFixed(1)} m²`],
            ["Oriëntatie", d.orientatie],
            ...(d.pandType === "Appartement" ? [
              ["Aandeel gemeenschappelijke delen", unit(d.gemeenschappelijkeDelenOpp, "m²")],
              ["Aandeel in de gemeenschap", d.aandeelDuizendsten ? `${d.aandeelDuizendsten}/1000` : "—"],
              ["Effectief grondaandeel", calc.effectiefGrondaandeel > 0 ? `${calc.effectiefGrondaandeel.toFixed(2)} m²` : "—"],
            ] : []),
          ]} />
          <ReportH>Bouwlaag</ReportH>
          <table className="w-full text-sm" style={{ fontFamily: "system-ui", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                {["Verdieping", "Opp. (m²)"].map((h) => (
                  <th key={h} className="text-left py-1" style={{ color: INK_SOFT, fontSize: 12, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.ruimtes.map((r) => {
                const v = VERDIEPINGEN.find((x) => x.key === r.verdieping);
                return (
                  <tr key={r.id} style={{ borderBottom: `1px dotted ${LINE}` }}>
                    <td className="py-1">{v ? v.label : r.verdieping}</td>
                    <td className="py-1">{dash(r.opp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ),
    },
    {
      title: "Constructie & isolatie",
      body: (
        <>
          <ReportH>Ruwbouw, gevels & dak</ReportH>
          <ReportGrid rows={[
            ["Ruwbouw", d.ruwbouw === "Andere" ? dash(d.ruwbouwAndere) : d.ruwbouw],
            ["Voorgevel", dash(d.voorgevel)], ["Zijgevel", dash(d.zijgevel)], ["Achtergevel", dash(d.achtergevel)],
            ["Materiaalkwaliteit muren & plafonds", dash(d.materiaalkwaliteitOmschrijving)],
            ["Hoofddak", d.hoofddakType], ["Materiaal hoofddak", d.hoofddakMateriaal],
            ["Bijgebouw", dash(d.bijgebouwConstructie)],
          ]} />
          <ReportH>Isolatie</ReportH>
          <ReportGrid rows={[
            ...(isResidentieel ? [["EPC", d.epcStatus], ["EPC-waarde", d.epcWaarde ? `${d.epcWaarde} kWh/m²` : "—"],
              ["EPC-certificaatnummer", dash(d.epcCertificaatnummer)]] : []),
            ["Isolatie", joinOrDash(d.isolatie)],
          ]} />
          <ReportH>Buitenschrijnwerk</ReportH>
          <div className="text-sm" style={{ fontFamily: "system-ui", color: INK_SOFT }}>{joinOrDash(d.buitenschrijnwerk)}</div>
        </>
      ),
    },
    {
      title: "Verwarming & technische installaties",
      body: (
        <>
          <ReportH>Verwarming</ReportH>
          <ReportGrid rows={[
            ["Soort", joinOrDash(d.verwarmingSoort)], ["Grondstof", joinOrDash(d.verwarmingGrondstof)],
            ["Verwarmingselementen", joinOrDash(d.verwarmingElementen)], ["Merk/type ketel", dash(d.ketelMerkType)],
          ]} />
          <ReportH>Warm water</ReportH>
          <ReportGrid rows={[
            ["Warm water", joinOrDash(d.warmWater)], ["Merk/type ketel", dash(d.warmWaterKetelMerkType)],
          ]} />
          <ReportH>Technische installaties</ReportH>
          <ReportGrid rows={[
            ["Elektrische keuring", d.keuringStatus], ["Dag + nacht teller", d.dagNachtTeller],
          ]} />
          <div className="text-sm mt-1" style={{ fontFamily: "system-ui", color: INK_SOFT }}>Allerlei: {joinOrDash(d.allerlei)}</div>
        </>
      ),
    },
    // de drie residentiële ruimte-pagina's hieronder horen bij StepRuimteEigenschappen, dat bij
    // KMO-vastgoed/Bedrijfsvastgoed vervangen is door StepBedrijfskenmerken (zie de steps-array in
    // DossierWizard) — dus verschijnen ze hier ook enkel bij Residentieel; anders komt in de plaats
    // één "Bedrijfskenmerken"-pagina, mét de subtype-specifieke kenmerken (Kantoor/Winkel/
    // Industrieel-logistiek/Horeca) indien van toepassing.
    ...(isResidentieel ? [
      {
        title: "Interieur — eigenschappen per ruimte",
        body: (
          <>
            <RoomBlock label="Hall" room={eig.hall} />
            <RoomBlock label="Woonkamer" room={eig.woonkamer} />
            <RoomBlock label="Keuken" room={eig.keuken} />
          </>
        ),
      },
      {
        title: "Interieur — slaapkamers & badkamer",
        body: (
          <>
            <ReportH>Interieur</ReportH>
            <table className="w-full text-sm mb-4" style={{ fontFamily: "system-ui", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                  {["Naam", "Vloer", "Verdieping", "Ingemaakte kasten", "Radiator"].map((h) => (
                    <th key={h} className="text-left py-1" style={{ color: INK_SOFT, fontSize: 12, fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.slaapkamers.map((s) => (
                  <tr key={s.id} style={{ borderBottom: `1px dotted ${LINE}` }}>
                    <td className="py-1">{s.naam}</td><td className="py-1">{dash(s.vloer)}</td>
                    <td className="py-1">{dash(s.verdieping)}</td><td className="py-1">{s.ingemaaktKasten}</td>
                    <td className="py-1">{s.radiator || "Nee"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <RoomBlock label="Badkamer" room={eig.badkamer} />
          </>
        ),
      },
      {
        title: "Exterieur — berging, kelder, garage & tuin",
        body: (
          <>
            <RoomBlock label="Berging" room={eig.berging} />
            <RoomBlock label="Kelder" room={eig.kelder} />
            <RoomBlock label="Garage / box / carport / oprit / staanplaats" room={eig.garage} cfg={RUIMTE_CHECKLISTS.find((c) => c.key === "garage")} />
            <RoomBlock label="Tuin / terras" room={eig.tuinTerras} />
            {(d.extraRuimtes || []).filter((r) => r.naam).map((r) => (
              <div key={r.id} className="mb-3">
                <div className="text-sm font-medium mb-1" style={{ fontFamily: "system-ui" }}>{r.naam}</div>
                <div className="text-sm" style={{ color: INK_SOFT, fontFamily: "system-ui" }}>
                  {r.vloer && <div>Vloer: {r.vloer}</div>}
                  {r.kenmerken && <div>{r.kenmerken}</div>}
                </div>
              </div>
            ))}
            {d.verbouwingen && (
              <>
                <ReportH>Verbouwingen / renovaties</ReportH>
                <div className="text-sm" style={{ fontFamily: "system-ui", color: INK_SOFT }}>{d.verbouwingen}</div>
              </>
            )}
          </>
        ),
      },
    ] : [
      {
        title: "Bedrijfskenmerken",
        body: (
          <>
            <ReportH>Algemene bedrijfskenmerken</ReportH>
            <ReportGrid rows={[
              ["Vervangingswaarde (nieuwbouw, na veroudering)", d.bedrijfsVervangingswaarde ? eur(num(d.bedrijfsVervangingswaarde)) : "—"],
              ["Bestemmingszone", dash(d.bedrijfsBestemmingszone)], ["Omgevingsvergunning milieu", dash(d.bedrijfsVergunningMilieu)],
              ["Aantal parkeerplaatsen", dash(d.bedrijfsParkeerplaatsen)], ["Aantal laadkades", dash(d.bedrijfsLaadkades)],
              ["EPC-regime", dash(d.bedrijfsEpcType)], ["EPC-waarde", dash(d.bedrijfsEpcWaarde)], ["EPC-certificaatnummer", dash(d.bedrijfsEpcCertificaatnummer)],
            ]} />
            {d.bedrijfsOmschrijvingIndeling && (
              <div className="text-sm mb-3" style={{ fontFamily: "system-ui", color: INK_SOFT, whiteSpace: "pre-wrap" }}>
                <strong style={{ color: INK }}>Omschrijving indeling & functionaliteit: </strong>{d.bedrijfsOmschrijvingIndeling}
              </div>
            )}
            <ReportH>Interne afwerking</ReportH>
            <ReportGrid rows={[
              ["Vloerafwerking", dash(d.bedrijfsVloerafwerking)], ["Wandafwerking", dash(d.bedrijfsWandafwerking)], ["Plafondafwerking", dash(d.bedrijfsPlafondafwerking)],
            ]} />
            {bedrijfsSubtype === "Kantoor" && (
              <>
                <ReportH>Kantoor — specifieke kenmerken</ReportH>
                <ReportGrid rows={[
                  ["Indeling", dash(d.kantoorIndeling)], ["Aantal verdiepingen", dash(d.kantoorVerdiepingen)],
                  ["Lift aanwezig", d.kantoorLiftAanwezig !== "Onbekend" ? d.kantoorLiftAanwezig : "—"],
                  ["Serverruimte/technisch lokaal", d.kantoorServerruimte !== "Onbekend" ? d.kantoorServerruimte : "—"],
                  ["Certificering", dash(d.kantoorCertificering)],
                ]} />
              </>
            )}
            {bedrijfsSubtype === "Winkel" && (
              <>
                <ReportH>Winkel — specifieke kenmerken</ReportH>
                <ReportGrid rows={[
                  ["Locatiecategorie", dash(d.winkelLocatiecategorie)], ["Gevelbreedte", unit(d.winkelGevelbreedte, "m")],
                  ["Etalage aanwezig", d.winkelEtalage !== "Onbekend" ? d.winkelEtalage : "—"],
                  ["Magazijn/opslag achteraan", d.winkelMagazijnAchteraan !== "Onbekend" ? d.winkelMagazijnAchteraan : "—"],
                  ["Inschatting voetgangersfrequentie", dash(d.winkelPasanten)],
                ]} />
              </>
            )}
            {bedrijfsSubtype === "Industrieel/logistiek" && (
              <>
                <ReportH>Industrieel/logistiek — specifieke kenmerken</ReportH>
                <ReportGrid rows={[
                  ["Vrije hoogte", unit(d.industrieelVrijeHoogte, "m")], ["Vloerbelasting", unit(d.industrieelVloerbelasting, "ton/m²")],
                  ["Aantal dock levellers", dash(d.industrieelAantalDockLevellers)], ["Elektrisch vermogen", dash(d.industrieelElektrischVermogen)],
                  ["Deelbaarheid", dash(d.industrieelDeelbaarheid)],
                ]} />
              </>
            )}
            {bedrijfsSubtype === "Horeca" && (
              <>
                <ReportH>Horeca — specifieke kenmerken</ReportH>
                <ReportGrid rows={[
                  ["Type horecazaak", dash(d.horecaType)],
                  ["Uitbatingsvergunning aanwezig", d.horecaVergunningUitbating !== "Onbekend" ? d.horecaVergunningUitbating : "—"],
                  ["Terras aanwezig", d.horecaTerras !== "Onbekend" ? d.horecaTerras : "—"],
                  ["Aantal zitplaatsen", dash(d.horecaZitplaatsen)], ["Keukenuitrusting", dash(d.horecaKeukenuitrusting)],
                ]} />
              </>
            )}
            {d.verbouwingen && (
              <>
                <ReportH>Verbouwingen / renovaties</ReportH>
                <div className="text-sm" style={{ fontFamily: "system-ui", color: INK_SOFT }}>{d.verbouwingen}</div>
              </>
            )}
          </>
        ),
      },
    ]),
    {
      title: "Markt & stedenbouwkundige gegevens",
      body: (
        <>
          <ReportH>Markt & algemeen gebruik</ReportH>
          <ReportGrid rows={[
            ["Gebruik", d.gebruik], [isResidentieel ? "Bewoonbaarheid" : "Functionele geschiktheid", d.bewoonbaarheid],
            ["Aanbod te koop", d.aanbodTeKoop], ["Aanbod te huur", d.aanbodTeHuur],
            ["Verkoopbaarheid", d.verkoopbaarheid], ["Uitzicht", d.uitzicht],
            ["Onderhoud", d.onderhoud], ["Inrichting", d.inrichting],
          ]} />
          <ReportH>Stedenbouwkundige gegevens</ReportH>
          <ReportGrid rows={[
            ["Gewestplan hoofdbestemming", d.gewestplan], ["Erfgoed", d.erfgoed],
            ["Voorkooprecht", d.voorkooprecht], ["Bouwmisdrijven", d.bouwmisdrijven],
            ["Vergunning", d.vergunning], ["Verkaveling", d.verkaveling],
            ["Watertoets P-score", d.watertoetsP], ["Watertoets G-score", d.watertoetsG],
            ["Mobiscore", d.mobiscore ? `${d.mobiscore}/10` : "—"],
          ]} />
          <ReportH>Juridische gegevens</ReportH>
          <ReportGrid rows={[
            ["Type verwervingsakte", dash(d.aankoopAkteType)], ["Datum verwervingsakte", nlDate(dash(d.aankoopAkteDatum))],
            ["Datum basisakte", nlDate(dash(d.basisAkteDatum))], ["Erfdienstbaarheden", dash(d.erfdienstbaarheden)],
            ["Overige zakelijke rechten", dash(d.zakelijkeRechten)],
          ]} />
        </>
      ),
    },
    {
      title: "SWOT-analyse",
      body: (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4" style={{ fontFamily: "system-ui" }}>
            <ReportList title="Sterktes" items={bullets(d.sterktes)} />
            <ReportList title="Zwaktes" items={bullets(d.zwaktes)} />
            <ReportList title="Kansen" items={bullets(d.kansen)} />
            <ReportList title="Bedreigingen" items={bullets(d.bedreigingen)} />
          </div>
          {d.conclusie && (
            <>
              <ReportH>Conclusie</ReportH>
              <p className="text-sm" style={{ fontFamily: "system-ui", color: INK_SOFT }}>{d.conclusie}</p>
            </>
          )}
        </>
      ),
    },
    {
      title: "Waardering",
      body: (
        <>
          <ReportH>Wijze van waardering</ReportH>
          <div className="text-sm mb-2" style={{ fontFamily: "system-ui", color: INK_SOFT }}>
            {d.wijzeVanWaardering}{d.wijzeVanWaarderingMotivering ? ` — ${d.wijzeVanWaarderingMotivering}` : ""}
          </div>
          {/* vergelijkingspunten enkel volledig tonen bij "Nalatenschap" — zie toelichting bij
              vglPuntenHtml in buildReportData (dezelfde regel geldt hier voor de voorvertoning) */}
          {d.wijzeVanWaardering === "Vergelijkende methode" && d.reden !== "Nalatenschap" && (
            <div className="text-sm mb-4 italic" style={{ fontFamily: "system-ui", color: INK_SOFT }}>
              VGL-punten ({d.vergelijkingspunten.length}) — Omwille van de GDPR-wetgeving kunnen de VGL-punten niet worden weergegeven in het verslag.
            </div>
          )}
          {/* rijen komen uit rapportVergelijkingspuntRijen (zie "GEDEELD RAPPORTMODEL") — exact
              dezelfde functie die ook de PDF (buildPandSections) voedt, inclusief de "Bron"-rij */}
          {d.wijzeVanWaardering === "Vergelijkende methode" && d.reden === "Nalatenschap" && d.vergelijkingspunten.map((v, i) => (
            <React.Fragment key={v.id}>
              <ReportH>Vergelijkingspunt {i + 1}</ReportH>
              <ReportGrid rows={rapportVergelijkingspuntRijen(v)} />
            </React.Fragment>
          ))}
          {/* waarderingsblokken komen uit rapportWaarderingsBlokken (zie "GEDEELD RAPPORTMODEL") —
              exact dezelfde volgorde, voorwaarden en cijfers als de PDF hierboven. */}
          {rapportWaarderingsBlokken(d, calc).map((blok) => (
            <React.Fragment key={blok.titel}>
              <ReportH>{blok.titel}</ReportH>
              <ReportGrid rows={blok.rijen} />
              {blok.motivering && <div className="text-xs mb-2" style={{ color: INK_SOFT }}>{blok.motivering}</div>}
            </React.Fragment>
          ))}
          <div className="text-sm mt-4 mb-1" style={{ fontFamily: "system-ui", color: INK_SOFT }}>
            {rapportVenaleWaardeZin(d)}
          </div>
          <div className="mt-2 p-4 rounded flex justify-between items-center" style={{ background: STAMP_SOFT }}>
            <span style={{ fontFamily: "Georgia, serif", fontWeight: 500, color: STAMP }}>Venale waarde</span>
            <span className="font-mono" style={{ fontSize: 20, fontWeight: 500, color: STAMP }}>{eur(calc.venaleWaarde)}</span>
          </div>
        </>
      ),
    },
    {
      title: "Eedformule",
      body: (
        <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: 280 }}>
          <p className="text-sm mb-10" style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 15, color: INK }}>
            "Ik zweer dat ik mijn opdracht in eer en geweten getrouw heb vervuld."
          </p>
          {(d.eedPlaats || d.datumVerslag) && (
            <div className="text-sm" style={{ fontFamily: "system-ui", color: INK_SOFT }}>
              {d.eedPlaats && `Gedaan te ${d.eedPlaats}`}{d.eedPlaats && d.datumVerslag && " op "}{!d.eedPlaats && d.datumVerslag && "Gedaan op "}{nlDate(d.datumVerslag)}
            </div>
          )}
          {d.handtekening && <img src={d.handtekening} alt="Handtekening" style={{ height: 70, marginTop: 24 }} />}
          {d.schatterNaam && <div className="text-sm" style={{ fontFamily: "system-ui", marginTop: d.handtekening ? 8 : 32 }}>{d.schatterNaam}</div>}
          {d.schatterTitel && <div className="text-xs" style={{ fontFamily: "system-ui", color: INK_SOFT }}>{d.schatterTitel}</div>}
        </div>
      ),
    },
    {
      title: "Bijlagen",
      body: (
        <>
          <div className="text-sm mb-3" style={{ fontFamily: "system-ui", color: INK_SOFT }}>
            {d.fotos.length} foto{d.fotos.length === 1 ? "" : "'s"}
          </div>
          {/* het interne notitieveld verschijnt bewust niet in het verslag — zie de toelichting bij
              de gelijkaardige sectie in buildPandSections hierboven */}
        </>
      ),
    },
  ];

  // paginanummering: voorblad telt niet mee (geen paginanummer, niet inbegrepen in "van X") —
  // nummering start pas bij 1 voor voorafgaande opmerkingen, 2 inhoudstafel, 3.. inhoud
  // (dit is enkel de on-scherm voorvertoning — elke sectie krijgt hier voor de duidelijkheid een
  // eigen kaartje; de échte, gedownloade PDF pakt secties waar mogelijk natuurlijk samen op één
  // pagina, zie buildPrintHtml/handlePrintPdf hieronder)
  const FIXED_PAGES = 2;
  const contentPageGroups = contentPages.map((p) => [p]);
  const totalPages = FIXED_PAGES + contentPageGroups.length;
  const opmerkingen = voorafgaandeOpmerkingen(d, totalPages);

  const handlePrintPdf = async () => {
    setError("");
    setExporting(true);
    // volwaardige versie met alle foto's als (blijvend geldige) base64-data — dit is wat de
    // terugval-HTML hieronder gebruikt, want een gedownload HTML-bestand kan de gebruiker later
    // pas openen, wanneer een tijdelijke Storage-link (zie verderop) al lang verlopen kan zijn.
    const htmlVolledig = buildPrintHtml(d, calc, hs);
    const adres = `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}`;
    const bestandsnaam = `Taxatieverslag_${(d.straat || "verslag").replace(/\s+/g, "_")}`;
    // paden van foto's die hieronder eventueel tijdelijk naar Storage worden opgeladen (enkel om
    // de aanvraaglimiet te omzeilen) — worden aan het einde altijd opgeruimd
    let tijdelijkeFotoPaden = [];
    try {
      let htmlVoorServer = htmlVolledig;
      // Vercel laat een serverless-functie-aanvraag van max. 4,5MB toe (niet-configureerbaar,
      // zie ook uploadDocVoorAnalyse hierboven voor hetzelfde probleem bij de AI-analyse) — bij
      // dossiers met veel/grote foto's overschrijdt de HTML (met alle foto's als base64 erin)
      // die grens, wat /api/generate-pdf laat falen met status 413
      // (FUNCTION_PAYLOAD_TOO_LARGE). Ruime marge (3,5MB) t.o.v. de 4,5MB-limiet voor de
      // JSON-overhead (adres/huisstijl-velden) en de rest van de HTML.
      if (htmlVolledig.length > 3.5 * 1024 * 1024) {
        const fotosMetBase64 = (d.fotos || []).filter((f) => f.base64);
        const geuploadeFotos = await Promise.all(
          fotosMetBase64.map(async (f) => ({ id: f.id, ...(await uploadFotoVoorPdf(f, d.id)) }))
        );
        tijdelijkeFotoPaden = geuploadeFotos.map((g) => g.pad);
        const urlPerFotoId = new Map(geuploadeFotos.map((g) => [g.id, g.url]));
        let dVoorServer = {
          ...d,
          fotos: d.fotos.map((f) => (urlPerFotoId.has(f.id) ? { ...f, base64: urlPerFotoId.get(f.id) } : f)),
        };
        if (d.voorpaginaFoto?.base64) {
          const geuploadeVoorpagina = await uploadFotoVoorPdf(d.voorpaginaFoto, d.id);
          tijdelijkeFotoPaden.push(geuploadeVoorpagina.pad);
          dVoorServer = { ...dVoorServer, voorpaginaFoto: { ...d.voorpaginaFoto, base64: geuploadeVoorpagina.url } };
        }
        htmlVoorServer = buildPrintHtml(dVoorServer, calc, hs);
      }

      // echte, rechtstreekse PDF-omzetting op de server — garandeert 100% dezelfde lay-out
      // als de HTML, want dezelfde HTML wordt via een headless Chromium-browser omgezet
      // (zie /api/generate-pdf in het hostingpakket). Enkel beschikbaar zodra de app
      // effectief gehost is met die server-functie; binnen Claude.ai zelf bestaat dat adres
      // niet en valt de app automatisch terug op de HTML-download hieronder.
      // "adres" wordt apart meegestuurd zodat de server een kopregel met adres kan tonen op elke
      // pagina (via Puppeteers headerTemplate) — dat hoort niet in de HTML zelf thuis, want de
      // kopregel moet op élke fysiek gerenderde pagina verschijnen, ongeacht waar de inhoud
      // natuurlijk afbreekt. "huisstijl" wordt om dezelfde reden apart meegestuurd — de
      // kop-/voettekst tonen de firmanaam op élke pagina, ongeacht de huisstijl van de ingelogde
      // gebruiker (zie kiesHuisstijl hierboven).
      const pdfToken = await haalSessieToken();
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(pdfToken ? { Authorization: `Bearer ${pdfToken}` } : {}) },
        body: JSON.stringify({ html: htmlVoorServer, adres, huisstijl: hs }),
      });
      if (!response.ok) {
        // de échte foutmelding van de server tonen (i.p.v. ze te verbergen achter een generieke
        // "niet beschikbaar") — cruciaal om een falende Chromium-render op de server te kunnen
        // onderscheiden van het geval waarin /api/generate-pdf helemaal niet bestaat (bv. binnen
        // Claude.ai zelf, of vóór hosting).
        let detail = `status ${response.status}`;
        try {
          const body = await response.json();
          if (body?.error) detail = body.error;
        } catch (e3) { /* antwoord was geen JSON, hou de status-tekst aan */ }
        throw new Error(detail);
      }
      // "0" = de server kon de paginanummers voor de inhoudstafel niet betrouwbaar opmeten (zie
      // tocMetingOk in api/generate-pdf.js) — het document zelf is verder volledig in orde en wordt
      // gewoon gedownload, maar de gebruiker moet dit wél zichtbaar te zien krijgen (audit, punt H3).
      const tocMetingOk = response.headers.get("X-Toc-Meting-Ok") !== "0";
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${bestandsnaam}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (!tocMetingOk) {
        setError("Let op: de paginanummering in de inhoudstafel kon niet automatisch berekend worden voor dit document (de rest van het verslag is wel volledig in orde). Open de gedownloade PDF en controleer de paginanummers in de inhoudstafel vóór u ze doorgeeft.");
      }
    } catch (e) {
      // terugval zonder server: HTML-bestand downloaden, zelf te openen en als PDF op te slaan —
      // altijd de volledige (base64) versie, nooit htmlVoorServer: die kan verlopen Storage-links
      // bevatten tegen de tijd dat de gebruiker dit bestand opent.
      try {
        const blob = new Blob([htmlVolledig], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${bestandsnaam}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setError(`Server-PDF mislukt (${e.message || "onbekende fout"}) — een HTML-bestand is in de plaats gedownload; open het en kies "Opslaan als PDF". Blijft dit gebeuren, controleer de functielogs van /api/generate-pdf op Vercel.`);
      } catch (e2) {
        setError("Kon het rapport niet voorbereiden. Probeer opnieuw.");
      }
    } finally {
      setExporting(false);
      // de tijdelijke foto-kopieën in Storage waren enkel nodig om deze ene aanvraag onder de
      // limiet te krijgen — nooit bedoeld om te blijven bestaan (de "echte" foto's blijven, zoals
      // altijd, als base64 in het dossier zelf bewaard)
      if (tijdelijkeFotoPaden.length) {
        supabase.storage.from("dossier-bijlagen").remove(tijdelijkeFotoPaden).catch(() => {});
      }
    }
  };

  return (
    <HuisstijlContext.Provider value={hs}>
    <div>
      <div className="no-print flex items-center justify-between mb-4">
        <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 500 }}>Rapportvoorbeeld</div>
        <div className="flex gap-2">
          <button onClick={handlePrintPdf} disabled={exporting || controle.blokkerend.length > 0}
            title={controle.blokkerend.length > 0 ? "Vul eerst de ontbrekende verplichte gegevens aan" : ""}
            className="text-xs px-3 py-1.5 rounded-lg text-white"
            style={{ background: controle.blokkerend.length > 0 ? INK_SOFT : INK, opacity: controle.blokkerend.length > 0 ? 0.6 : 1 }}>
            {exporting ? "Bezig..." : "Download PDF"}
          </button>
        </div>
      </div>

      {/* Controle vóór aflevering (zie valideerDossier): ontbrekende velden verdwijnen anders
          geruisloos uit de PDF, waardoor een onvolledig verslag er volkomen normaal uitziet. */}
      {controle.blokkerend.length > 0 && (
        <div className="no-print mb-4 px-4 py-3 rounded-lg" style={{ background: "#FBEAEA", border: `1px solid ${DANGER}` }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: DANGER, fontWeight: 600, fontSize: 13 }}>
            <AlertTriangle size={14} /> Nog niet klaar om af te leveren
          </div>
          <ul className="text-xs" style={{ color: INK, lineHeight: 1.7, paddingLeft: 18, listStyle: "disc" }}>
            {controle.blokkerend.map((punt) => <li key={punt}>{punt}</li>)}
          </ul>
        </div>
      )}
      {controle.aandachtspunten.length > 0 && (
        <div className="no-print mb-4 px-4 py-3 rounded-lg" style={{ background: BRASS_SOFT, border: `1px solid ${BRASS}` }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: BRASS, fontWeight: 600, fontSize: 13 }}>
            <AlertTriangle size={14} /> Aandachtspunten — je kan het verslag wel aanmaken
          </div>
          <ul className="text-xs" style={{ color: INK, lineHeight: 1.7, paddingLeft: 18, listStyle: "disc" }}>
            {controle.aandachtspunten.map((punt) => <li key={punt}>{punt}</li>)}
          </ul>
        </div>
      )}
      {error && (
        <div className="no-print flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
          <AlertTriangle size={13} /> {error}
        </div>
      )}
      <div className="no-print text-xs mb-4" style={{ color: INK_SOFT }}>
        "Download PDF" vraagt een rechtstreeks PDF-bestand op bij de server — dat is enkel actief zodra de app gehost is met de meegeleverde server-functie (zie hostingpakket). Wordt die niet gevonden (zoals hier, binnen Claude.ai), dan downloadt de app in de plaats een HTML-bestand dat je zelf opent; het printvenster start dan automatisch — kies daar "Opslaan als PDF".
      </div>

      {/* dit on-scherm voorbeeld toont enkel het hoofdpand (zie StepRapport hierboven — het blijft
          bewust een JSX-weergave van d zelf, los van buildReportData/buildMultiPandReportData) —
          de effectief gedownloade PDF is wél altijd volledig: die doorloopt bij meerdere panden
          buildMultiPandReportData (zie handlePrintPdf/buildPrintHtml hierboven) en bevat dan élk
          pand plus de portefeuille-samenvatting met totaalsom. Deze melding voorkomt dat een
          schatter-expert dit onvolledige scherm per ongeluk voor het volledige verslag aanziet. */}
      {d.extraPanden && d.extraPanden.length > 0 && (
        <div className="no-print flex items-start gap-2 text-xs mb-4 px-3 py-2.5 rounded-lg" style={{ background: BRASS_SOFT, color: INK, border: `1px solid ${BRASS}` }}>
          <AlertTriangle size={14} style={{ color: BRASS, flexShrink: 0, marginTop: 1 }} />
          <span>Dit dossier bevat {d.extraPanden.length + 1} panden. Dit voorbeeld hieronder toont enkel het hoofdpand — de gedownloade PDF bevat wel elk pand afzonderlijk, plus een samenvattende tabel met de totale waarde van het hele dossier (zie tabblad "Panden").</span>
        </div>
      )}

      <div ref={reportRef}>
      {/* voorblad — telt niet mee in de paginanummering (geen paginanummer, geen deel van "van X") */}
      <Page n={1} total={totalPages} noFooter huisstijl={huisstijl}>
        <div className="flex flex-col items-center justify-center text-center" style={{ height: "100%" }}>
          {hs.logo && <img src={hs.logo} alt={hs.naam} style={{ width: 64, height: 64, objectFit: "contain", marginBottom: 14 }} />}
          <div className="mb-8" style={{ fontSize: 15, color: hs.kleur, letterSpacing: 2, fontFamily: "system-ui" }}>{hs.naam.toUpperCase()}</div>
          {(d.voorpaginaFoto?.url || d.voorpaginaFoto?.base64) && (
            <img src={d.voorpaginaFoto.url || d.voorpaginaFoto.base64} alt="Voorpagina"
              style={{ width: 380, maxWidth: "80%", height: 260, objectFit: "cover", borderRadius: 6, border: `1px solid ${LINE}`, marginBottom: 26 }} />
          )}
          <div className="mb-3" style={{ fontSize: 15, color: INK_SOFT, letterSpacing: 1, fontFamily: "system-ui", textTransform: "uppercase" }}>Taxatieverslag</div>
          <h1 style={{ fontSize: 40, fontWeight: 500, marginBottom: 18 }}>{adres}</h1>
          <div style={{ fontSize: 17, color: INK_SOFT, fontFamily: "system-ui" }}>
            {d.opdrachtgeverNaam && <>Opgemaakt voor {d.opdrachtgeverNaam} · </>}reden: {d.reden.toLowerCase()}
          </div>
          {d.datumVerslag && <div className="mt-1" style={{ fontSize: 17, color: INK_SOFT, fontFamily: "system-ui" }}>Datum verslag: {nlDate(d.datumVerslag)}</div>}
          {(d.schatterNaam || d.schatterTitel || d.schatterBivNummer || d.schatterVlabelNummer || d.schatterTelefoon) && (
            <div className="mt-10 pt-4" style={{ borderTop: `1px solid ${LINE}` }}>
              {d.schatterNaam && <div style={{ fontSize: 14 }}>{d.schatterNaam}</div>}
              {d.schatterTitel && <div style={{ fontSize: 12, color: INK_SOFT }}>{d.schatterTitel}</div>}
              {d.schatterBivNummer && <div style={{ fontSize: 11, color: INK_SOFT }}>BIV-nummer: {d.schatterBivNummer}</div>}
              {d.schatterVlabelNummer && <div style={{ fontSize: 11, color: INK_SOFT }}>Vlabel-identificatienummer: {d.schatterVlabelNummer}</div>}
              {d.schatterTelefoon && <div style={{ fontSize: 11, color: INK_SOFT }}>Tel.: {d.schatterTelefoon}</div>}
            </div>
          )}
        </div>
      </Page>

      {/* pagina 1: voorafgaande opmerkingen (voorblad telt niet mee in de paginanummering) */}
      <Page n={1} total={totalPages} huisstijl={huisstijl}>
        <h2 style={{ fontSize: 15, fontWeight: 500, letterSpacing: 0.5, marginBottom: 14, fontFamily: "Georgia, serif" }}>VOORAFGAANDE OPMERKINGEN</h2>
        <ul className="text-sm" style={{ fontFamily: "Georgia, serif", color: INK_SOFT, lineHeight: 1.7 }}>
          {opmerkingen.map((o, i) => <li key={i} className="mb-2 pl-4" style={{ textIndent: "-1em" }}>• {o}</li>)}
        </ul>
      </Page>

      {/* pagina 2: inhoudstafel */}
      <Page n={2} total={totalPages} huisstijl={huisstijl}>
        <h2 style={{ fontSize: 15, fontWeight: 500, letterSpacing: 0.5, marginBottom: 14, fontFamily: "Georgia, serif" }}>INHOUD</h2>
        <div style={{ fontFamily: "Georgia, serif" }}>
          {["Voorafgaande opmerkingen", "Inhoud"].map((t, i) => (
            <div key={t} className="flex justify-between text-sm py-1.5" style={{ borderBottom: `1px dotted ${LINE}` }}>
              <span>{t}</span><span className="font-mono" style={{ color: INK_SOFT }}>{i + 1}</span>
            </div>
          ))}
          {contentPageGroups.map((group, i) => group.map((p) => (
            <div key={p.title} className="flex justify-between text-sm py-1.5" style={{ borderBottom: `1px dotted ${LINE}` }}>
              <span>{p.title}</span><span className="font-mono" style={{ color: INK_SOFT }}>{FIXED_PAGES + i + 1}</span>
            </div>
          )))}
        </div>
      </Page>

      {/* inhoudspagina's */}
      {contentPageGroups.map((group, i) => (
        <Page key={group[0].title} n={FIXED_PAGES + i + 1} total={totalPages} huisstijl={huisstijl}>
          {group.map((p, gi) => (
            <div key={p.title} style={{ marginTop: gi > 0 ? 24 : 0 }}>
              <div className="mb-4" style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 500, color: INK }}>{p.title}</div>
              {p.body}
            </div>
          ))}
        </Page>
      ))}
      </div>
    </div>
    </HuisstijlContext.Provider>
  );
}
