// ----------------------------------------------------------------------------
// domein/epc.js — EPC per vastgoedtype, geldigheid en renovatieplicht (Vlaanderen)
// ----------------------------------------------------------------------------
// Residentieel: label A+ t/m F en een energiescore in kWh/m² per jaar; geldig 10 jaar.
// Niet-residentieel:
//   - EPC NR (niet-residentiële eenheid): label A (best) t/m G, of X als de meetgegevens
//     ontbreken; energiescore in kWh/m² per jaar; geldig maximaal 5 jaar.
//   - EPC kNR (kleine niet-residentiële eenheid, bruikbare vloeroppervlakte ≤ 500 m², die op een
//     woning lijkt): label A+ t/m F, zoals residentieel. De geldigheidsduur staat niet eenduidig
//     op de officiële pagina, dus die rekent de app niet uit.
// Renovatieplicht bij overdracht (vanaf 2022 voor niet-residentieel, termijn 6 jaar sinds 2026):
//   - residentieel: label E of F → binnen 6 jaar na de akte minstens label D;
//   - niet-residentieel: binnen 6 jaar dak, beglazing, verwarming en koeling op minimumniveau
//     + label E (grote eenheid) of label C (kleine eenheid ≤ 500 m²); bij een gedeeltelijke
//     overdracht van een groter gebouw label D. Industrieel gebruik > 70% valt erbuiten.
//   - vanaf 2030 moet elke grote niet-residentiële eenheid minstens label E halen.
// Bronnen: vlaanderen.be (EPC NR, EPC kNR, renovatieverplichting niet-residentiële gebouwen),
// stand oktober 2026. De teksten zijn bedoeld als vermelding in het verslag, niet als juridisch
// advies; de schatter-expert kan ze altijd aanvullen.
// Pure functies — apart testbaar (zie __tests__/epc.test.js).
import { isBedrijfsmatig, typeVan, INDUSTRIE } from "./vastgoedtypes.js";

export const EPC_LABELS_RESIDENTIEEL = ["A+", "A", "B", "C", "D", "E", "F"];
export const EPC_LABELS_NR = ["A", "B", "C", "D", "E", "F", "G", "X"];
export const EPC_REGIMES_NR = [
  "EPC NR (niet-residentieel)",
  "EPC kNR (klein niet-residentieel, ≤ 500 m²)",
  "Niet vereist (bv. industrie > 70%, eenheid < 50 m²)",
  "Nog niet beschikbaar / aangevraagd",
];
export const KLEINE_EENHEID_M2 = 500;

const getal = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : null; };

// "NR" | "kNR" | "geen" | "onbekend" — herkent ook de oudere omschrijvingen van het EPC-regime
export function epcRegime(d) {
  if (!isBedrijfsmatig(d)) return "residentieel";
  if (typeVan(d) === INDUSTRIE && d.bedrijfsIndustrieelMeer70 === "Ja") return "geen";
  const r = String(d.bedrijfsEpcType || "");
  if (/kNR/.test(r)) return "kNR";
  if (/EPC NR/.test(r)) return "NR";
  if (/Niet vereist/i.test(r)) return "geen";
  return "onbekend";
}

// labelschaal voor het pand: residentieel en kNR A+..F, NR A..G + X
export function epcLabelsVoor(d) {
  const regime = epcRegime(d);
  if (regime === "residentieel" || regime === "kNR") return EPC_LABELS_RESIDENTIEEL;
  return EPC_LABELS_NR;
}

const plusJaren = (iso, jaren) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${Number(m[1]) + jaren}-${m[2]}-${m[3]}` : "";
};

// samenvatting van het EPC van een pand, ongeacht het type. peildatum (ISO) bepaalt "verlopen":
// standaard de referentiedatum van het dossier.
export function epcGegevens(d, peildatum = d.referentiedatum || "") {
  const regime = epcRegime(d);
  const res = regime === "residentieel";
  const label = res ? (d.epcLabel || "") : (d.bedrijfsEpcLabel || "");
  const score = getal(res ? d.epcWaarde : d.bedrijfsEpcWaarde);
  const datum = res ? (d.epcDatum || "") : (d.bedrijfsEpcDatum || "");
  const geldigheidJaren = res ? 10 : regime === "NR" ? 5 : null;
  const geldigTot = geldigheidJaren && datum ? plusJaren(datum, geldigheidJaren) : "";
  return {
    regime, label, score, datum, geldigTot,
    verlopen: !!(geldigTot && peildatum && geldigTot < peildatum),
    certificaat: res ? (d.epcCertificaatnummer || "") : (d.bedrijfsEpcCertificaatnummer || ""),
    oppervlakte: res ? null : getal(d.bedrijfsEpcOppervlakte),
  };
}

// X (geen meetgegevens) is geen rangorde en telt dus niet als "slechter"
const slechterDan = (label, grens, schaal) => {
  if (label === "X") return false;
  const i = schaal.indexOf(label), g = schaal.indexOf(grens);
  return i >= 0 && g >= 0 && i > g;
};

// renovatieplicht en verwante aandachtspunten voor het verslag en de app
// → { tekst: string (leeg = niets te vermelden), waarschuwingen: string[] }
export function renovatieplicht(d, peildatum) {
  const e = epcGegevens(d, peildatum);
  const waarschuwingen = [];
  if (e.verlopen) waarschuwingen.push(`Het EPC is verlopen (geldig tot ${e.geldigTot.split("-").reverse().join("/")}).`);

  if (e.regime === "residentieel") {
    const tekst = ["E", "F"].includes(e.label)
      ? `Het EPC-label is ${e.label}. Bij een overdracht van een woning of appartement met label E of F geldt een renovatieplicht: de koper moet binnen 6 jaar na de akte minstens label D halen.`
      : "";
    return { tekst, waarschuwingen };
  }

  if (e.regime === "geen") {
    const industrie = typeVan(d) === INDUSTRIE && d.bedrijfsIndustrieelMeer70 === "Ja";
    return {
      tekst: industrie
        ? "Het industriële gebruik beslaat meer dan 70% van de bruikbare vloeroppervlakte: de eenheid valt buiten het EPC NR en de renovatieplicht voor niet-residentiële gebouwen."
        : "",
      waarschuwingen,
    };
  }

  const klein = e.regime === "kNR" || (e.oppervlakte !== null && e.oppervlakte <= KLEINE_EENHEID_M2);
  const eisLabel = klein ? "C" : "E";
  const schaal = epcLabelsVoor(d);
  const delen = [
    "Bij een overdracht van een niet-residentiële eenheid geldt een renovatieplicht: binnen 6 jaar na de akte moeten dakisolatie, beglazing, verwarming en koeling aan de minimale eisen voldoen",
    `en moet de eenheid minstens label ${eisLabel} halen (${klein ? `kleine eenheid, ≤ ${KLEINE_EENHEID_M2} m²` : "grote eenheid; als alternatief volstaat 5% hernieuwbare energie"}; bij een gedeeltelijke overdracht van een groter gebouw label D).`,
  ];
  if (!klein) delen.push("Vanaf 2030 moet elke grote niet-residentiële eenheid hoe dan ook minstens label E halen.");
  if (e.label && slechterDan(e.label, eisLabel, schaal)) {
    delen.push(`Met het huidige label ${e.label} is een energetische renovatie dus nodig.`);
  }
  // bewust "Onbekend" gekozen = geen herinnering meer; enkel bij een nog leeg veld
  if (e.regime === "onbekend" && d.bedrijfsEpcType !== "Onbekend") waarschuwingen.push("Kies het EPC-regime (EPC NR, EPC kNR of niet vereist).");
  if (!e.label && e.regime !== "onbekend") waarschuwingen.push("Het EPC-label ontbreekt.");
  if (e.label === "X") waarschuwingen.push("Label X: het EPC NR werd opgemaakt zonder meetgegevens.");
  if (!klein && e.label && slechterDan(e.label, "E", schaal)) {
    waarschuwingen.push(`Label ${e.label}: een grote niet-residentiële eenheid moet vanaf 2030 minstens label E halen.`);
  }
  return { tekst: delen.join(" "), waarschuwingen };
}

// rijen [label, waarde] voor het verslag (PDF én voorbeeld) — lege waarden laat de tabel weg
const nlDatum = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso || "")) ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");
export function epcRapportRijen(d) {
  const e = epcGegevens(d);
  const res = e.regime === "residentieel";
  return [
    res ? ["EPC", d.epcStatus] : ["EPC-regime", d.bedrijfsEpcType],
    ...(!res && typeVan(d) === INDUSTRIE && d.bedrijfsIndustrieelMeer70 && d.bedrijfsIndustrieelMeer70 !== "Onbekend"
      ? [["Industrieel gebruik > 70% van de vloeroppervlakte", d.bedrijfsIndustrieelMeer70]] : []),
    ["EPC-label", e.label],
    ["Energiescore", e.score !== null ? `${String(e.score).replace(".", ",")} kWh/m² per jaar` : ""],
    ["Datum EPC", nlDatum(e.datum)],
    ["Geldig tot", nlDatum(e.geldigTot) + (e.verlopen ? " (verlopen)" : "")],
    ...(!res ? [["Bruikbare vloeroppervlakte volgens het EPC", e.oppervlakte !== null ? `${String(e.oppervlakte).replace(".", ",")} m²` : ""]] : []),
    ["EPC-certificaatnummer", e.certificaat],
  ].map(([k, v]) => [k, v === " (verlopen)" ? "" : v]);
}
