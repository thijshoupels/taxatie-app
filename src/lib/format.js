// ============================================================================
// FORMATTEER- EN ESCAPE-HELPERS
// ============================================================================
// Kleine, zuivere (geen DOM/React) helpers voor getallen, geld, percentages, datums en
// HTML-escaping — gebruikt zowel door de rekenmodule als door de rapport-opbouw (PDF + scherm).
// Verplaatst uit App.jsx (zie audit, punt "App.jsx opsplitsen").
// ============================================================================

// ---------- helpers ----------
// Getallen in het Nederlands: de schatter-expert typt een decimale KOMMA (12,5 m²). Invoervelden
// (ui/velden.jsx, GetalInput) bewaren een getal altijd met een punt ("12.5"), zodat de berekeningen
// en de opgeslagen dossiers niet veranderen; leesGetal leest daarnaast ook een komma (oudere of
// door AI ingevulde waarden, plakken uit een ander document). Regels:
//   "12,5" → 12,5   "1.250,5" → 1250,5 (punt = duizendtal naast een komma)
//   "1.250.000" → 1250000 (meerdere punten = duizendtallen)
//   "12.5" → 12,5 (één punt zonder komma blijft een decimaalteken, zoals vroeger)
// Geen getal → NaN (num maakt daar 0 van, zoals voorheen).
const normaliseerGetalInvoer = (t) => {
  let s = String(t ?? "").replace(/[\s\u00a0\u202f]/g, "").replace(/[^\d.,-]/g, "");
  const negatief = s.startsWith("-");
  s = s.replace(/-/g, "");
  if (s.includes(",")) {
    s = s.replace(/\./g, "");
    const i = s.indexOf(",");
    s = s.slice(0, i) + "." + s.slice(i + 1).replace(/,/g, "");
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, "");
  }
  return (negatief ? "-" : "") + s;
};
const leesGetal = (v) => {
  if (typeof v === "number") return v;
  if (v === null || v === undefined || typeof v === "boolean") return NaN;
  const s = String(v).trim();
  if (!s) return NaN;
  // zonder komma en met hoogstens één punt: exact zoals vroeger (parseFloat)
  if (!s.includes(",") && (s.match(/\./g) || []).length <= 1) return parseFloat(s);
  // anders enkel omzetten wat op een getal lijkt (met eventueel een eenheid erachter, bv. "12,5 m²")
  const m = /^-?[\d\s\u00a0\u202f.,]+/.exec(s);
  return m ? parseFloat(normaliseerGetalInvoer(m[0])) : NaN;
};
// opgeslagen waarde ("12.5") → zoals ze in een invoerveld staat ("12,5")
const getalVoorInvoer = (v) => (v === null || v === undefined ? "" : String(v).replace(".", ","));
const num = (v) => { const n = leesGetal(v); return isNaN(n) ? 0 : n; };
// Louter indicatieve, informatieve richtwaarde voor de optionele energiecorrectie in de
// waardering — vult niets automatisch in, dient enkel als leeswijzer naast het EPC-veld. De
// schatter-expert bepaalt het effectieve correctiepercentage steeds zelf.
const epcRichtwaardePct = (epcWaarde) => {
  const kwh = leesGetal(epcWaarde);
  if (isNaN(kwh)) return 0;
  if (kwh <= 100) return 2;
  if (kwh <= 200) return 1;
  if (kwh <= 300) return 0;
  if (kwh <= 400) return -2;
  return -4;
};
const eur = (v) => v.toLocaleString("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const pct = (v) => `${v.toFixed(2).replace(".", ",")}%`;
// zet een datum om van het ISO-formaat van <input type="date"> (JJJJ-MM-DD) naar de Vlaamse
// notatie (DD/MM/JJJJ) — enkel voor weergave in het rapport, het onderliggende veld blijft ISO.
const nlDate = (v) => {
  if (!v) return v;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
};
const uid = () => Math.random().toString(36).slice(2, 9);

const dash = (v) => (v === "" || v === null || v === undefined ? "—" : v);
const joinOrDash = (arr) => (arr && arr.length ? arr.join(", ") : "—");
const unit = (v, u) => (v === "" || v === null || v === undefined ? "—" : `${v} ${u}`);
const isEmptyVal = (v) => v === "" || v === null || v === undefined || v === "—";

const wEsc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");


export { num, leesGetal, normaliseerGetalInvoer, getalVoorInvoer, epcRichtwaardePct, eur, pct, nlDate, uid, dash, joinOrDash, unit, isEmptyVal, wEsc };
