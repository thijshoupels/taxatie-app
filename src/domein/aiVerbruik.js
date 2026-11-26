// ----------------------------------------------------------------------------
// domein/aiVerbruik.js — AI-verbruik samenvatten per account, per week en per functie
// ----------------------------------------------------------------------------
// Pure functie (geen React, geen Supabase): krijgt de ruwe rijen uit de tabel ai_verbruik (zie
// supabase/ai-verbruik.sql en api/claude.js) en geeft de totalen terug voor het overzicht in
// ui/AiVerbruikOverzicht.jsx. Bedragen zijn GESCHATTE kosten aan catalogusprijs (USD, excl. btw).

const leeg = () => ({ aanroepen: 0, invoerTokens: 0, uitvoerTokens: 0, webzoekopdrachten: 0, kostenUsd: 0 });

function telOp(doel, r) {
  doel.aanroepen += 1;
  doel.invoerTokens += Number(r.invoer_tokens) || 0;
  doel.uitvoerTokens += Number(r.uitvoer_tokens) || 0;
  doel.webzoekopdrachten += Number(r.webzoekopdrachten) || 0;
  doel.kostenUsd += Number(r.kosten_usd) || 0;
}

// maandag van de week (lokale tijd) als "JJJJ-MM-DD"
export function weekVan(datum) {
  const d = new Date(datum);
  const dag = (d.getDay() + 6) % 7; // maandag = 0
  d.setDate(d.getDate() - dag);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function vatVerbruikSamen(rijen) {
  const totaal = leeg();
  const accounts = new Map();
  const weken = new Map();
  const functies = new Map();
  for (const r of rijen || []) {
    telOp(totaal, r);
    const sleutel = r.gebruiker_id || r.email || "onbekend";
    if (!accounts.has(sleutel)) accounts.set(sleutel, { gebruikerId: r.gebruiker_id || null, email: r.email || "(onbekend)", ...leeg(), laatste: null });
    const acc = accounts.get(sleutel);
    telOp(acc, r);
    if (!acc.laatste || r.aangemaakt_op > acc.laatste) acc.laatste = r.aangemaakt_op;
    const week = weekVan(r.aangemaakt_op);
    if (!weken.has(week)) weken.set(week, { week, ...leeg() });
    telOp(weken.get(week), r);
    const f = r.functie || "onbekend";
    if (!functies.has(f)) functies.set(f, { functie: f, ...leeg() });
    telOp(functies.get(f), r);
  }
  const aandeel = (k) => (totaal.kostenUsd > 0 ? k / totaal.kostenUsd : 0);
  return {
    totaal,
    perAccount: [...accounts.values()].map((a) => ({ ...a, aandeel: aandeel(a.kostenUsd) })).sort((a, b) => b.kostenUsd - a.kostenUsd),
    perWeek: [...weken.values()].sort((a, b) => b.week.localeCompare(a.week)),
    perFunctie: [...functies.values()].map((f) => ({ ...f, aandeel: aandeel(f.kostenUsd) })).sort((a, b) => b.kostenUsd - a.kostenUsd),
  };
}
