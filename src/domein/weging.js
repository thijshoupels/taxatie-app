// ----------------------------------------------------------------------------
// domein/weging.js — samenstelling van de venale waarde uit de waarderingsmethodes
// ----------------------------------------------------------------------------
// Rekenregels versie 2 (zie berekenWaardering, d.rekenversie):
//
//   - Elke methode levert een eigen uitkomst: de analytische methode (intrinsieke waarde +
//     eventuele energiecorrectie), de vergelijkingsmethode (gecorrigeerde referentieprijzen, zie
//     domein/vergelijking.js) en de rendementsbenadering (directe kapitalisatie en/of meerjaren-DCF,
//     of bij bedrijfsvastgoed de huurwaardebenadering).
//   - De venale waarde is het GEWOGEN gemiddelde van de methodes met een uitkomst. De schatter-expert
//     kiest de weging zelf; leeg = standaardweging per vastgoedtype (hieronder). Een methode met
//     weging 0 telt niet mee maar wordt wel als CONTROLE berekend en vermeld (met haar afwijking).
//   - Standaard telt de rendementsbenadering bij woningen enkel als controle: bij een eigenaar-
//     bewoonde woning bepaalt de huurmarkt de prijs niet, en één huuraanname laat de uitkomst
//     makkelijk € 100.000 schuiven. Bij bedrijfsvastgoed weegt ze wel standaard mee.
//   - De voorgestelde venale waarde wordt afgerond (standaard automatisch: € 1.000 onder
//     € 100.000, € 5.000 tot € 1 miljoen, € 10.000 daarboven).
//
// Versie 1 (dossiers van vóór deze regels) rekent ongewijzigd verder in berekenWaardering zelf.
// Pure functies — apart testbaar (zie __tests__/weging.test.js).

export const METHODE_LABELS = {
  kosten: "Analytische methode (kostenbenadering)",
  vergelijking: "Vergelijkingsmethode",
  rendement: "Rendementsbenadering",
};

// standaardweging (in %) per categorie
export const STANDAARD_WEGING = {
  residentieel: { kosten: 40, vergelijking: 60, rendement: 0 },
  bedrijf: { kosten: 50, vergelijking: 0, rendement: 50 },
  garage: { kosten: 50, vergelijking: 50, rendement: 0 },
};
const VELD = { kosten: "wegingKostenPct", vergelijking: "wegingVergelijkingPct", rendement: "wegingRendementPct" };
export const WEGING_VELDEN = VELD;

const getal = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return isFinite(n) && n >= 0 ? n : null;
};

// waarden: { kosten, vergelijking, rendement } (0/undefined = geen uitkomst)
// categorie: "residentieel" | "bedrijf" | "garage"
// → { methodes: [{ sleutel, label, waarde, wegingPct (ingesteld), gewicht (0..1, genormaliseerd),
//      controle, standaard }], gewogen, rendementLabel }
export function wegMethodes(d, waarden, categorie, labels = {}) {
  const std = STANDAARD_WEGING[categorie] || STANDAARD_WEGING.residentieel;
  const kandidaten = ["kosten", "vergelijking", "rendement"]
    .filter((s) => waarden[s] > 0)
    .map((s) => {
      const ingesteld = getal(d[VELD[s]]);
      return { sleutel: s, label: labels[s] || METHODE_LABELS[s], waarde: waarden[s], wegingPct: ingesteld !== null ? ingesteld : std[s], standaard: ingesteld === null };
    });
  let som = kandidaten.reduce((s, m) => s + m.wegingPct, 0);
  // niemand weegt mee (bv. enkel een rendementswaarde bij een woning): dan bepaalt de
  // kostenbenadering, en anders de eerste methode met een uitkomst, toch de waarde — zonder dat
  // zou er geen venale waarde zijn
  if (som === 0 && kandidaten.length) {
    const terugval = kandidaten.find((m) => m.sleutel === "kosten") || kandidaten[0];
    terugval.wegingPct = 100;
    terugval.terugval = true;
    som = 100;
  }
  const methodes = kandidaten.map((m) => ({ ...m, gewicht: som > 0 ? m.wegingPct / som : 0, controle: m.wegingPct === 0 }));
  const gewogen = methodes.reduce((s, m) => s + m.gewicht * m.waarde, 0);
  return { methodes, gewogen };
}

export const AFRONDING_OPTIES = ["Automatisch", "Geen", "1000", "5000", "10000"];
export function afrondingsStap(waarde, keuze) {
  if (keuze === "Geen") return 0;
  const vast = getal(keuze);
  if (vast) return vast;
  const w = Math.abs(waarde);
  return w < 100000 ? 1000 : w < 1000000 ? 5000 : 10000;
}
export const afronden = (waarde, stap) => (stap > 0 ? Math.round(waarde / stap) * stap : waarde);

// directe kapitalisatie: jaarhuur gekapitaliseerd aan het GEMIDDELDE rendement van de gekozen reeks
// (niet het gemiddelde van de uitkomsten per rendement: dat ligt altijd hoger, want 1/y is convex),
// daarna gedeeld door (1 + kosten koper) — de koper betaalt de kosten bovenop de prijs, dus de
// prijs = investeringswaarde / (1 + kosten), niet investeringswaarde × (1 − kosten).
export function kapitaliseer(jaarhuur, rendementPct, kostenPct = 0) {
  if (!(jaarhuur > 0) || !(rendementPct > 0)) return 0;
  return jaarhuur / (rendementPct / 100) / (1 + (kostenPct || 0) / 100);
}

// gevoeligheid van de rendementswaarde voor de twee aannames: maandhuur (−20%, −10%, 0, +10%) en
// rendement (van, gemiddeld, tot)
export function gevoeligheidstabel({ huurMaand, maandenPerJaar, rendementen, kostenPct }) {
  const h = Number(huurMaand) || 0;
  const ys = [...new Set(rendementen.filter((y) => y > 0).map((y) => Math.round(y * 100) / 100))].sort((a, b) => a - b);
  if (!(h > 0) || !ys.length) return null;
  const huren = [0.8, 0.9, 1, 1.1].map((f) => Math.round(h * f / 10) * 10);
  return {
    rendementen: ys,
    rijen: huren.map((hm) => ({ huurMaand: hm, basis: hm === Math.round(h / 10) * 10, waarden: ys.map((y) => kapitaliseer(hm * maandenPerJaar, y, kostenPct)) })),
  };
}
