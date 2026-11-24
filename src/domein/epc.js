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
//     (maatregelenpakket) + label E (grote eenheid; label E = minstens 5% hernieuwbare energie) of
//     label C (kleine eenheid ≤ 500 m²). De labeleis geldt enkel als het niet-residentiële gebouw in
//     zijn geheel verkocht wordt; bij een gedeeltelijke overdracht geldt enkel het maatregelenpakket.
//     Industrieel gebruik > 70% van de bruikbare vloeroppervlakte valt erbuiten.
//   - sinds 1/1/2026 moet elke grote niet-residentiële eenheid een EPC NR hebben, ook zonder
//     verkoop of verhuur; vanaf 2030 moet ze minstens label E halen.
// Residentiële labelschaal (energiescore in kWh/m² per jaar): A+ ≤ 0, A ≤ 100, B ≤ 200, C ≤ 300,
// D ≤ 400, E ≤ 500, F > 500. Een EPC-certificaatnummer begint met de opmaakdatum (JJJJMMDD-…);
// een EPC van vóór 2019 mag enkel nog bij verhuur gebruikt worden, niet bij een verkoop.
// Bronnen: vlaanderen.be (EPC NR, EPC kNR, renovatieverplichting niet-residentiële gebouwen),
// stand oktober 2026. De teksten zijn bedoeld als vermelding in het verslag, niet als juridisch
// advies; de schatter-expert kan ze altijd aanvullen.
// Pure functies — apart testbaar (zie __tests__/epc.test.js).
import { isBedrijfsmatig, isGrond, typeVan, INDUSTRIE } from "./vastgoedtypes.js";

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

// residentiële labelschaal (EPC sinds 2019): het label dat bij een energiescore hoort
export const RESIDENTIELE_LABELGRENZEN = [["A+", 0], ["A", 100], ["B", 200], ["C", 300], ["D", 400], ["E", 500]];
export function labelVoorScoreResidentieel(score) {
  const s = getal(score);
  if (s === null) return "";
  const rij = RESIDENTIELE_LABELGRENZEN.find(([, grens]) => s <= grens);
  return rij ? rij[0] : "F";
}

// opmaakdatum uit het certificaatnummer ("20160415-0001853753-1" → "2016-04-15"), of "" als het
// nummer niet zo begint of geen geldige datum bevat
export function datumUitCertificaat(cert) {
  const m = /^\s*(\d{4})(\d{2})(\d{2})(?:[-\s]|$)/.exec(String(cert || ""));
  if (!m) return "";
  const [j, mnd, dag] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (j < 2007 || j > 2100 || mnd < 1 || mnd > 12 || dag < 1 || dag > 31) return "";
  return `${m[1]}-${m[2]}-${m[3]}`;
}
const nlDatumKort = (iso) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

// "NR" | "kNR" | "geen" | "onbekend" — herkent ook de oudere omschrijvingen van het EPC-regime
export function epcRegime(d) {
  // grond zonder gebouw (bouwgrond, landbouwgrond): geen EPC
  if (isGrond(d)) return "geen";
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
  const certificaat = res ? (d.epcCertificaatnummer || "") : (d.bedrijfsEpcCertificaatnummer || "");
  const datumCertificaat = datumUitCertificaat(certificaat);
  const geldigheidJaren = res ? 10 : regime === "NR" ? 5 : null;
  // de opmaakdatum in het certificaatnummer is door het systeem toegekend en dus betrouwbaarder dan
  // een overgetypte datum: die bepaalt de geldigheid als ze er is (een verschil meldt epcConsistentie)
  const basisDatum = datumCertificaat || datum;
  const geldigTot = geldigheidJaren && basisDatum ? plusJaren(basisDatum, geldigheidJaren) : "";
  return {
    regime, label, score, datum, geldigTot, datumCertificaat,
    verlopen: !!(geldigTot && peildatum && geldigTot < peildatum),
    certificaat,
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
    waarschuwingen.push(...epcConsistentie(d, e));
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
  // Regime nog niet bepaald (bv. een loods waarvan niet vaststaat of het industriële gebruik meer
  // dan 70% beslaat): dan staat de renovatieplicht voorwaardelijk in het verslag, niet als feit —
  // voordien kreeg zo'n pand dezelfde stellige tekst als een pand dat zeker onder het EPC NR valt,
  // terwijl een gelijkaardige loods in hetzelfde verslag (industrie > 70%) er buiten viel.
  const onbekend = e.regime === "onbekend";
  const industrieOnbepaald = onbekend && typeVan(d) === INDUSTRIE && !["Ja", "Nee"].includes(d.bedrijfsIndustrieelMeer70);
  const delen = [
    onbekend
      ? `Valt de eenheid onder het EPC NR${industrieOnbepaald ? " (dus niet als het industriële gebruik meer dan 70% van de bruikbare vloeroppervlakte beslaat)" : ""}, dan geldt bij een overdracht een renovatieplicht: binnen 6 jaar na de akte moeten dakisolatie, beglazing, verwarming en koeling aan de minimale eisen voldoen`
      : "Bij een overdracht van een niet-residentiële eenheid geldt een renovatieplicht: binnen 6 jaar na de akte moeten dakisolatie, beglazing, verwarming en koeling aan de minimale eisen voldoen",
    `en moet de eenheid minstens label ${eisLabel} halen (${klein ? `kleine eenheid, ≤ ${KLEINE_EENHEID_M2} m²` : "grote eenheid; label E betekent minstens 5% hernieuwbare energie"}). Die labeleis geldt enkel als het niet-residentiële gebouw in zijn geheel verkocht wordt; bij een gedeeltelijke overdracht geldt enkel het maatregelenpakket.`,
  ];
  if (!klein) delen.push("Sinds 1 januari 2026 moet elke grote niet-residentiële eenheid over een EPC NR beschikken. Vanaf 2030 moet ze hoe dan ook minstens label E halen.");
  if (e.label && slechterDan(e.label, eisLabel, schaal)) {
    delen.push(`Met het huidige label ${e.label} is een energetische renovatie dus nodig.`);
  }
  // bewust "Onbekend" gekozen = geen herinnering meer; enkel bij een nog leeg veld
  if (e.regime === "onbekend" && d.bedrijfsEpcType !== "Onbekend") waarschuwingen.push("Kies het EPC-regime (EPC NR, EPC kNR of niet vereist).");
  if (industrieOnbepaald) waarschuwingen.push("Bepaal (met de energiedeskundige) of het industriële gebruik meer dan 70% van de bruikbare vloeroppervlakte beslaat: dat beslist of het EPC NR en de renovatieplicht gelden.");
  if (!e.label && e.regime !== "onbekend") waarschuwingen.push(e.regime === "NR" && !klein ? "Het EPC-label ontbreekt — sinds 1 januari 2026 moet elke grote niet-residentiële eenheid over een EPC NR beschikken." : "Het EPC-label ontbreekt.");
  if (e.label === "X") waarschuwingen.push("Label X: het EPC NR werd opgemaakt zonder meetgegevens.");
  if (!klein && e.label && slechterDan(e.label, "E", schaal)) {
    waarschuwingen.push(`Label ${e.label}: een grote niet-residentiële eenheid moet vanaf 2030 minstens label E halen.`);
  }
  return { tekst: delen.join(" "), waarschuwingen };
}

// Interne samenhang van een residentieel EPC: label ↔ energiescore, datum ↔ certificaatnummer, en
// een EPC van vóór 2019 bij een verkoop. Elk punt is een korte zin voor de schatter-expert (app en
// inhoudelijke controles), nooit tekst voor het verslag.
export function epcConsistentie(d, e = epcGegevens(d)) {
  const uit = [];
  if (e.regime !== "residentieel") return uit;
  const verwacht = e.score !== null ? labelVoorScoreResidentieel(e.score) : "";
  if (e.label && verwacht && e.label !== verwacht) {
    uit.push(`Label ${e.label} past niet bij de energiescore van ${String(e.score).replace(".", ",")} kWh/m² (dat is label ${verwacht}) — controleer het EPC.`);
  }
  if (e.datumCertificaat && e.datum && e.datumCertificaat !== String(e.datum).slice(0, 10)) {
    uit.push(`Het certificaatnummer wijst op een EPC van ${nlDatumKort(e.datumCertificaat)}, maar als datum staat ${nlDatumKort(e.datum)} ingevuld — controleer de datum (ze bepaalt de geldigheid).`);
  }
  const opmaak = e.datumCertificaat || String(e.datum || "").slice(0, 10);
  if (d.reden === "Verkoop" && opmaak && opmaak < "2019-01-01") {
    uit.push(`Het EPC dateert van ${nlDatumKort(opmaak)}: een EPC van vóór 2019 mag bij een verkoop niet meer gebruikt worden (enkel nog bij verhuur) — laat een nieuw EPC opmaken.`);
  }
  return uit;
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
