// ----------------------------------------------------------------------------
// stappen/VlabelVglPaneel.jsx — Vlabel-verkoopprijzenlijst opladen, beoordelen en overnemen
// ----------------------------------------------------------------------------
// Onderdeel van het tabblad "Vergelijkingspunten". De schatter laadt de .xls op die hij van Vlabel
// kreeg; de app groepeert per verkoop, beoordeelt elke verkoop volgens vaste regels t.o.v. het te
// schatten goed (zie domein/vlabelVgl.js) en schrijft per verkoop een toelichting. Met één klik
// wordt een verkoop een gewoon vergelijkingspunt (met die toelichting als "afweging").
//
// Privacy: Vlabel verstrekt deze gegevens uitsluitend voor de betrokken opdracht (zie de kop van de
// lijst zelf). De lijst wordt daarom enkel in dít dossier bewaard (geen gedeelde databank over
// dossiers heen), er gaat niets naar een AI-dienst, en de schatter kan ze op elk moment verwijderen.
import React, { useState } from "react";
import { FileSpreadsheet, Upload, Check, Trash2, AlertTriangle, Loader2, Plus } from "lucide-react";
import { INK, INK_SOFT, LINE, PAPER_RAISED, ACCENT, ACCENT_SOFT, DANGER, STAMP } from "../constants.js";
import { inputStyle } from "../ui/velden.jsx";
import { eur } from "../lib/format.js";
import { leesXls } from "../lib/xlsLezen.js";
import { fetchCadgisPerceel } from "../kaarten.jsx";
import {
  leesVlabelLijst, onderwerpUitDossier, beoordeelLijst, naarVergelijkingspunt, GEWICHTEN, PERIODE_MAANDEN,
} from "../domein/vlabelVgl.js";

const vandaagIso = () => new Date().toISOString().slice(0, 10);
const datumNl = (iso) => (iso ? iso.split("-").reverse().join("/") : "");

// middelpunt van een perceel uit de CadGIS-geometrie
function middelpunt(ringen) {
  const punten = (ringen || []).flat();
  if (!punten.length) return null;
  const x = punten.reduce((s, p) => s + p[0], 0) / punten.length;
  const y = punten.reduce((s, p) => s + p[1], 0) / punten.length;
  return [x, y];
}
async function coordinaatVoor(capakey) {
  if (!capakey) return null;
  try {
    const perceel = await Promise.race([
      fetchCadgisPerceel(capakey),
      new Promise((r) => setTimeout(() => r(null), 10000)),
    ]);
    return perceel ? middelpunt(perceel.ringen) : null;
  } catch {
    return null; // bv. geen verbinding of een bronperceel dat intussen niet meer bestaat
  }
}

const GROEPEN = [
  { status: "relevant", titel: "Meest relevant", uitleg: "Voldoen aan alle voorwaarden en scoren minstens 60/100." },
  { status: "bevestigen", titel: "Bebouwingsvorm te bevestigen", uitleg: "Staat niet in de Vlabel-lijst en kon niet afgeleid worden — kies hieronder open, halfopen of gesloten." },
  { status: "minder", titel: "Minder vergelijkbaar", uitleg: "Voldoen aan de voorwaarden, maar scoren lager dan 60/100." },
  { status: "reserve", titel: "Reservepunten", uitleg: `Net buiten de periode van ${PERIODE_MAANDEN} maanden — niet meegerekend, enkel te gebruiken met bijkomende motivering.` },
  { status: "uitgesloten", titel: "Niet weerhouden", uitleg: "Met de reden erbij." },
];

// referentiedatum: dossierbreed veld — een extra pand (zie maakLeegPand) heeft er zelf geen, dus
// komt die apart mee vanuit de wizard
export function VlabelVglPaneel({ d, calc, set, referentiedatum, addVergelijkingspunt }) {
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const lijst = d.vlabelVgl || null;

  const opladen = async (e) => {
    const bestand = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!bestand) return;
    setBezig(true);
    setFout("");
    try {
      const gelezen = leesVlabelLijst(leesXls(await bestand.arrayBuffer()).bladen);
      if (!gelezen.verkopen.length) throw new Error("De lijst bevat geen verkopen.");
      // afstanden: middelpunt van elk (hoofd)perceel via de kadasterdienst die de app al gebruikt
      const coordinaten = {};
      const wachtrij = [...gelezen.verkopen];
      await Promise.all(Array.from({ length: 4 }, async () => {
        while (wachtrij.length) {
          const v = wachtrij.shift();
          const c = await coordinaatVoor(v.percelen[v.hoofdIdx].capakey);
          if (c) coordinaten[v.nr] = c;
        }
      }));
      const onderwerpCoordinaat = d.cadgisRingen?.length ? middelpunt(d.cadgisRingen) : await coordinaatVoor(d.capakey);
      set("vlabelVgl")({
        bestandsnaam: bestand.name, ingeladenOp: vandaagIso(),
        afgeleverdOp: gelezen.afgeleverdOp, opmerkingAflevering: gelezen.opmerkingAflevering,
        verkopen: gelezen.verkopen, bevestigdeBebouwing: {}, coordinaten, onderwerpCoordinaat,
      });
    } catch (err) {
      setFout(err.message || "De lijst kon niet gelezen worden.");
    } finally {
      setBezig(false);
    }
  };

  const verwijderen = () => {
    if (!window.confirm("De Vlabel-lijst uit dit dossier verwijderen? Reeds overgenomen vergelijkingspunten blijven staan.")) return;
    set("vlabelVgl")(null);
  };

  const opladenKnop = (label) => (
    <label className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg cursor-pointer text-white"
      style={{ background: bezig ? "#B8B4A8" : STAMP }}>
      {bezig ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
      {bezig ? "Lijst inlezen en afstanden opzoeken…" : label}
      <input type="file" accept=".xls,application/vnd.ms-excel" onChange={opladen} disabled={bezig} style={{ display: "none" }} />
    </label>
  );

  const kop = (
    <div className="flex items-center gap-2 mb-3">
      <FileSpreadsheet size={15} style={{ color: ACCENT }} />
      <h3 style={{ fontSize: 16, color: INK, fontWeight: 500 }}>Vlabel-verkoopprijzen</h3>
    </div>
  );

  if (!lijst) {
    return (
      <div className="mb-8">
        {kop}
        <div className="text-sm mb-3" style={{ color: INK_SOFT }}>
          Laad de lijst met verkoopprijzen op die je van Vlabel kreeg (.xls). De app groepeert per verkoop, sluit niet-vergelijkbare
          verkopen uit, rangschikt de rest t.o.v. het te schatten goed en schrijft per punt een toelichting.
        </div>
        {opladenKnop("Vlabel-lijst (.xls) opladen")}
        {fout && <Melding kleur={DANGER}>{fout}</Melding>}
      </div>
    );
  }

  const o = onderwerpUitDossier({ ...d, referentiedatum: d.referentiedatum || referentiedatum || "" }, calc, vandaagIso());
  const resultaten = beoordeelLijst(lijst, o, {
    bevestigdeBebouwing: lijst.bevestigdeBebouwing || {}, coordinaten: lijst.coordinaten || {},
    onderwerpCoordinaat: lijst.onderwerpCoordinaat || null, vandaagIso: vandaagIso(),
  });
  const ontbreekt = [
    !o.bebouwing && o.hoofdtype === "woning" && "bebouwingsvorm (tabblad Type)",
    !o.nuttigeOpp && "oppervlakte (tabblad Afmetingen)",
    o.hoofdtype !== "appartement" && !o.grondOpp && "grondoppervlakte",
    !o.bouwjaar && "bouwjaar (tabblad Type)",
  ].filter(Boolean);
  const aantalRelevant = resultaten.filter((r) => r.beoordeling.status === "relevant").length;
  const overgenomen = (v) => (d.vergelijkingspunten || []).some((p) => p.vlabelNr === v.nr && (p.vlabelRef || "") === (v.refBronakte || ""));

  const bevestig = (nr, waarde) => {
    const bb = { ...(lijst.bevestigdeBebouwing || {}) };
    if (waarde) bb[nr] = waarde; else delete bb[nr];
    set("vlabelVgl")({ ...lijst, bevestigdeBebouwing: bb });
  };

  return (
    <div className="mb-8">
      {kop}
      <div className="rounded-lg p-3 mb-3 text-sm" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong>{lijst.bestandsnaam}</strong>
            <span style={{ color: INK_SOFT }}> — afgeleverd op {datumNl(lijst.afgeleverdOp) || "?"} — {lijst.verkopen.length} verkopen</span>
          </div>
          <div className="flex items-center gap-2">
            {opladenKnop("Andere lijst opladen")}
            <button onClick={verwijderen} className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg"
              style={{ border: `1px solid ${LINE}`, color: DANGER }}>
              <Trash2 size={12} /> Lijst verwijderen
            </button>
          </div>
        </div>
        {lijst.opmerkingAflevering && (
          <div className="text-xs mt-2" style={{ color: INK }}><strong>Opmerking van Vlabel bij aflevering:</strong> {lijst.opmerkingAflevering}</div>
        )}
        <div className="text-xs mt-2" style={{ color: INK_SOFT }}>
          Vlabel verstrekt deze gegevens uitsluitend voor deze opdracht: de lijst blijft enkel in dit dossier bewaard. Verwijder ze wanneer het dossier afgewerkt is.
        </div>
      </div>
      {fout && <Melding kleur={DANGER}>{fout}</Melding>}

      <div className="text-xs mb-3 p-3 rounded-lg" style={{ background: ACCENT_SOFT, color: INK }}>
        <strong>Te schatten goed:</strong>{" "}
        {[
          o.hoofdtype,
          o.bebouwing && `${o.bebouwing.toLowerCase()} bebouwing`,
          o.nuttigeOpp && `${Math.round(o.nuttigeOpp)} m² gewogen nuttige opp. (${o.nuttigeOppBron})`,
          o.grondOpp && `${Math.round(o.grondOpp)} m² grond`,
          o.bouwjaar && `bouwjaar ${o.bouwjaar}`,
          `referentiedatum ${datumNl(o.referentiedatum)}${o.referentieIsVandaag ? " (nog niet ingevuld — vandaag gebruikt)" : ""}`,
        ].filter(Boolean).join(", ")}.
        {ontbreekt.length > 0 && <div className="mt-1" style={{ color: DANGER }}>Nog in te vullen voor een volledige beoordeling: {ontbreekt.join(", ")}.</div>}
        {o.bebouwing && <div className="mt-1" style={{ color: INK_SOFT }}>Controleer de bebouwingsvorm in tabblad Type: die weegt het zwaarst ({GEWICHTEN.bebouwing}/100).</div>}
        <div className="mt-1" style={{ color: INK_SOFT }}>
          Score op 100: bebouwingsvorm {GEWICHTEN.bebouwing}, gewogen nuttige opp. {GEWICHTEN.nuttigeOpp}, afstand {GEWICHTEN.afstand}, grond {GEWICHTEN.grond}, bouwjaar {GEWICHTEN.bouwjaar}, recentheid {GEWICHTEN.recentheid}. Wat niet te beoordelen valt, telt niet mee.
        </div>
      </div>
      {aantalRelevant < 3 && (
        <Melding kleur={DANGER}>
          Slechts {aantalRelevant} {aantalRelevant === 1 ? "verkoop komt" : "verkopen komen"} volledig in aanmerking. Vul eventueel ontbrekende gegevens aan of bevestig de bebouwingsvorm; blijft het aantal te laag, vraag dan een gerichtere lijst aan Vlabel of motiveer de afwijking.
        </Melding>
      )}

      {GROEPEN.map((g) => {
        const items = resultaten.filter((r) => r.beoordeling.status === g.status);
        if (!items.length) return null;
        const inhoud = items.map(({ verkoop: v, beoordeling: b }) => (
          <VerkoopKaart key={v.nr} v={v} b={b} o={o} overgenomen={overgenomen(v)}
            onBevestig={(w) => bevestig(v.nr, w)}
            onOvernemen={() => addVergelijkingspunt(naarVergelijkingspunt(v, b, { afgeleverdOp: lijst.afgeleverdOp }))} />
        ));
        const titel = <span style={{ fontSize: 14, fontWeight: 500 }}>{g.titel} ({items.length})</span>;
        return g.status === "uitgesloten" ? (
          <details key={g.status} className="mb-4">
            <summary className="cursor-pointer mb-2">{titel} <span className="text-xs" style={{ color: INK_SOFT }}>— {g.uitleg}</span></summary>
            {inhoud}
          </details>
        ) : (
          <div key={g.status} className="mb-4">
            <div className="mb-2">{titel} <span className="text-xs" style={{ color: INK_SOFT }}>— {g.uitleg}</span></div>
            {inhoud}
          </div>
        );
      })}
    </div>
  );
}

function Melding({ kleur, children }) {
  return (
    <div className="flex items-start gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: kleur }}>
      <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{children}</span>
    </div>
  );
}

function VerkoopKaart({ v, b, o, overgenomen, onBevestig, onOvernemen }) {
  const uitgesloten = b.status === "uitgesloten";
  return (
    <div className="rounded-lg p-3 mb-2" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED, opacity: uitgesloten ? 0.85 : 1 }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{v.adres}, {v.plaats}</div>
          <div className="text-xs" style={{ color: INK_SOFT }}>
            {datumNl(v.datum)} · {v.prijs ? eur(v.prijs) : v.prijsTekst || "geen prijs"}
            {b.prijsPerM2Nuttig ? ` · ${eur(b.prijsPerM2Nuttig)}/m² nuttig` : ""}
            {v.nuttigeOpp ? ` · ${Math.round(v.nuttigeOpp)} m² nuttig` : ""}
            {v.grondOpp ? ` · ${Math.round(v.grondOpp)} m² grond` : ""}
          </div>
        </div>
        {!uitgesloten && b.score !== null && (
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: ACCENT_SOFT, color: INK, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {b.score}/100
          </span>
        )}
      </div>
      {!uitgesloten && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {b.criteria.map((c) => (
            <span key={c.sleutel} title={c.tekst} className="text-xs px-2 py-0.5 rounded"
              style={{ border: `1px solid ${LINE}`, color: c.punten === null ? INK_SOFT : INK, fontVariantNumeric: "tabular-nums" }}>
              {c.label}: {c.punten === null ? "–" : Math.round(c.punten)}/{c.gewicht}
            </span>
          ))}
        </div>
      )}
      {!uitgesloten && o.hoofdtype === "woning" && (
        <div className="flex items-center gap-2 mt-2 text-xs">
          <span style={{ color: INK_SOFT }}>Bebouwingsvorm:</span>
          <select value={b.bebouwing?.bron === "bevestigd" ? b.bebouwing.waarde : ""} onChange={(e) => onBevestig(e.target.value)}
            style={{ ...inputStyle, width: "auto", padding: "3px 6px", fontSize: 12 }}>
            <option value="">{b.bebouwing?.bron === "afgeleid" ? `${b.bebouwing.waarde} (afgeleid)` : "— onbekend —"}</option>
            <option value="Open">Open</option>
            <option value="Halfopen">Halfopen</option>
            <option value="Gesloten">Gesloten</option>
          </select>
        </div>
      )}
      <p className="text-sm mt-2" style={{ color: INK, lineHeight: 1.55 }}>{b.toelichting}</p>
      {!uitgesloten && (
        <div className="mt-2">
          {overgenomen ? (
            <span className="inline-flex items-center gap-1 text-xs" style={{ color: ACCENT }}><Check size={13} /> Overgenomen als vergelijkingspunt</span>
          ) : (
            <button onClick={onOvernemen} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
              style={{ border: `1px solid ${ACCENT}`, color: ACCENT }}>
              <Plus size={13} /> Overnemen als vergelijkingspunt
            </button>
          )}
        </div>
      )}
    </div>
  );
}
