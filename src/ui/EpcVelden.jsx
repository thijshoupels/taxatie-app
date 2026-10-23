// ----------------------------------------------------------------------------
// ui/EpcVelden.jsx — EPC-invoer per vastgoedtype (residentieel / EPC NR / EPC kNR)
// ----------------------------------------------------------------------------
// Residentieel (tabblad Constructie & isolatie): status, label A+–F, energiescore, datum,
// certificaatnummer. Niet-residentieel (tabblad Bedrijfskenmerken): EPC-regime, label (NR: A–G/X,
// kNR: A+–F), energiescore, datum, bruikbare vloeroppervlakte volgens het EPC en — bij Industrie &
// logistiek — of het industriële gebruik meer dan 70% beslaat. Daaronder meteen de renovatieplicht
// en de aandachtspunten (verlopen EPC, label X, label-E-doel 2030), zoals ze in het verslag komen.
// Alle regels zitten in domein/epc.js; dit is enkel de invoer.
import React from "react";
import { AlertTriangle, Info } from "lucide-react";
import { INK, INK_SOFT, DANGER, ACCENT_SOFT, LINE, OPTS } from "../constants.js";
import { Field, TextInput, Select } from "./velden.jsx";
import { epcRegime, epcLabelsVoor, epcGegevens, renovatieplicht, EPC_REGIMES_NR } from "../domein/epc.js";
import { typeVan, INDUSTRIE } from "../domein/vastgoedtypes.js";

const metHuidige = (opties, waarde) => (!waarde || opties.includes(waarde) ? opties : [waarde, ...opties]);

export function EpcVelden({ d, set }) {
  const regime = epcRegime(d);
  const res = regime === "residentieel";
  const labels = epcLabelsVoor(d);
  const e = epcGegevens(d);
  const rp = renovatieplicht(d);
  const k = res
    ? { label: "epcLabel", score: "epcWaarde", datum: "epcDatum", cert: "epcCertificaatnummer" }
    : { label: "bedrijfsEpcLabel", score: "bedrijfsEpcWaarde", datum: "bedrijfsEpcDatum", cert: "bedrijfsEpcCertificaatnummer" };
  const geenEpc = regime === "geen";
  return (
    <>
      {res ? (
        <Field label="EPC"><Select options={OPTS.epcStatus} value={d.epcStatus} onChange={set("epcStatus")} /></Field>
      ) : (
        <Field label="EPC-regime" hint="EPC NR: niet-residentiële eenheid · EPC kNR: kleine eenheid (≤ 500 m²) die op een woning lijkt">
          <Select options={metHuidige(EPC_REGIMES_NR, d.bedrijfsEpcType)} leeg="— kies —" value={d.bedrijfsEpcType || ""} onChange={set("bedrijfsEpcType")} />
        </Field>
      )}
      {!res && typeVan(d) === INDUSTRIE && (
        <Field label="Industrieel gebruik > 70% van de vloeroppervlakte?" hint="Dan valt de eenheid buiten het EPC NR en de renovatieplicht">
          <Select options={OPTS.jaNee} value={d.bedrijfsIndustrieelMeer70 || "Onbekend"} onChange={set("bedrijfsIndustrieelMeer70")} />
        </Field>
      )}
      {!geenEpc && (
        <>
          <Field label="EPC-label" hint={res || regime === "kNR" ? "Schaal A+ (best) tot F" : "Schaal A (best) tot G — X als het EPC zonder meetgegevens werd opgemaakt"}>
            <Select options={metHuidige(labels, d[k.label])} leeg="— kies —" value={d[k.label] || ""} onChange={set(k.label)} />
          </Field>
          <Field label="Energiescore (kWh/m² per jaar)">
            <TextInput type="number" value={d[k.score]} onChange={set(k.score)} />
          </Field>
          <Field label="Datum EPC" hint={res ? "Geldig 10 jaar" : regime === "NR" ? "Geldig maximaal 5 jaar" : undefined}>
            <TextInput type="date" value={d[k.datum] || ""} onChange={set(k.datum)} />
          </Field>
          {!res && (
            <Field label="Bruikbare vloeroppervlakte volgens het EPC (m²)" hint="≤ 500 m² = kleine eenheid (renovatieplicht label C i.p.v. E)">
              <TextInput type="number" value={d.bedrijfsEpcOppervlakte || ""} onChange={set("bedrijfsEpcOppervlakte")} />
            </Field>
          )}
          <Field label="EPC-certificaatnummer" full><TextInput value={d[k.cert]} onChange={set(k.cert)} /></Field>
        </>
      )}
      {(rp.tekst || rp.waarschuwingen.length > 0) && (
        <div className="md:col-span-2 rounded-md p-3 text-xs" style={{ border: `1px solid ${LINE}`, background: ACCENT_SOFT, lineHeight: 1.55 }}>
          {rp.tekst && (
            <div className="flex items-start gap-1.5" style={{ color: INK }}>
              <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
              <span><strong style={{ fontWeight: 600 }}>Komt in het verslag:</strong> {rp.tekst}</span>
            </div>
          )}
          {rp.waarschuwingen.map((w) => (
            <div key={w} className="flex items-start gap-1.5 mt-1.5" style={{ color: DANGER }}>
              <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} /> <span>{w}</span>
            </div>
          ))}
          {e.geldigTot && !e.verlopen && (
            <div className="mt-1.5" style={{ color: INK_SOFT }}>Geldig tot {e.geldigTot.split("-").reverse().join("/")}.</div>
          )}
        </div>
      )}
    </>
  );
}
