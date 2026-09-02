// ============================================================================
// FORMATTEER- EN ESCAPE-HELPERS
// ============================================================================
// Kleine, zuivere (geen DOM/React) helpers voor getallen, geld, percentages, datums en
// HTML-escaping — gebruikt zowel door de rekenmodule als door de rapport-opbouw (PDF + scherm).
// Verplaatst uit App.jsx (zie audit, punt "App.jsx opsplitsen").
// ============================================================================

// ---------- helpers ----------
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
// Louter indicatieve, informatieve richtwaarde voor de optionele energiecorrectie in de
// waardering — vult niets automatisch in, dient enkel als leeswijzer naast het EPC-veld. De
// schatter-expert bepaalt het effectieve correctiepercentage steeds zelf.
const epcRichtwaardePct = (epcWaarde) => {
  const kwh = parseFloat(epcWaarde);
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


export { num, epcRichtwaardePct, eur, pct, nlDate, uid, dash, joinOrDash, unit, isEmptyVal, wEsc };
