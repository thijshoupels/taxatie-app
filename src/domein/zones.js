// ----------------------------------------------------------------------------
// domein/zones.js — oppervlakte per functie en huurwaardebenadering (niet-residentieel)
// ----------------------------------------------------------------------------
// Bij bedrijfsvastgoed wordt de oppervlakte niet per woonverdieping maar per FUNCTIE opgemeten:
// kantoor, magazijn, productie, showroom, mezzanine, … Elke zone krijgt een oppervlakte, een
// nieuwbouwprijs per m² en een markthuur per m² per jaar. Daaruit volgen twee benaderingen:
//
//   1. Kostenbenadering: som van (oppervlakte × nieuwbouwprijs) per zone = nieuwbouwwaarde, waarop
//      berekenWaardering de vetusteit toepast en de grondwaarde bijtelt.
//   2. Huurwaardebenadering (inkomstenbenadering op markthuur):
//        markthuur (ERV)           = som van (oppervlakte × markthuur) per zone
//        netto huurwaarde          = ERV × (1 − structurele leegstand) × (1 − niet-recupereerbare kosten)
//        investeringswaarde        = netto huurwaarde / aanvangsrendement   (kosten koper inbegrepen)
//        waarde na kosten koper    = investeringswaarde / (1 + kosten koper)
//      De effectieve huur (huurMaand × 12) wordt naast de markthuur gezet: een pand dat duidelijk
//      boven of onder de markt verhuurd is, verdient een toelichting in het verslag.
//
// Parkeerplaatsen tellen per stuk (bouwprijs en markthuur per plaats), buitenopslag/verharding
// telt mee in huur en bouwwaarde maar niet in de overdekte vloeroppervlakte.
// Pure functies — apart testbaar (zie __tests__/zones.test.js).

export const ZONE_FUNCTIES = [
  { key: "kantoor", label: "Kantoor" },
  { key: "magazijn", label: "Magazijn / opslag" },
  { key: "productie", label: "Productie / atelier" },
  { key: "showroom", label: "Showroom / winkelruimte" },
  { key: "mezzanine", label: "Mezzanine" },
  { key: "sociaal", label: "Sociale ruimtes / sanitair" },
  { key: "horeca", label: "Horecaruimte (zaal / keuken)" },
  { key: "techniek", label: "Technische ruimte" },
  { key: "buiten", label: "Buitenopslag / verharding", overdekt: false },
  { key: "parking", label: "Parkeerplaatsen", eenheid: "st.", overdekt: false },
  { key: "andere", label: "Andere" },
];
const FUNCTIE = Object.fromEntries(ZONE_FUNCTIES.map((f) => [f.key, f]));
export const functieVan = (key) => FUNCTIE[key] || FUNCTIE.andere;
export const eenheidVan = (key) => functieVan(key).eenheid || "m²";

// voorstel van zones bij een nieuw bedrijfsdossier, per type
export const STANDAARD_ZONES = {
  Kantoor: ["kantoor", "sociaal", "techniek", "parking"],
  "KMO-unit / gemengd": ["kantoor", "magazijn", "mezzanine", "parking"],
  "Industrie & logistiek": ["productie", "magazijn", "kantoor", "buiten", "parking"],
  Retail: ["showroom", "magazijn", "parking"],
  Horeca: ["horeca", "sociaal", "parking"],
};

const getal = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : 0; };

// zones: [{ id, functie, opp, bouwprijs, markthuur, omschrijving }]
export function berekenZones(zones) {
  const rijen = (zones || []).map((z) => {
    const opp = getal(z.opp), bouwprijs = getal(z.bouwprijs), markthuur = getal(z.markthuur);
    const f = functieVan(z.functie);
    return { ...z, label: z.omschrijving || f.label, eenheid: f.eenheid || "m²", overdekt: f.overdekt !== false,
      oppGetal: opp, nieuwbouw: opp * bouwprijs, huurJaar: opp * markthuur, bouwprijsGetal: bouwprijs, markthuurGetal: markthuur };
  });
  const vloerOpp = rijen.filter((r) => r.overdekt).reduce((s, r) => s + r.oppGetal, 0);
  const buitenOpp = rijen.filter((r) => !r.overdekt && r.eenheid === "m²").reduce((s, r) => s + r.oppGetal, 0);
  const parkeerplaatsen = rijen.filter((r) => r.eenheid === "st.").reduce((s, r) => s + r.oppGetal, 0);
  const nieuwbouwwaarde = rijen.reduce((s, r) => s + r.nieuwbouw, 0);
  const markthuurJaar = rijen.reduce((s, r) => s + r.huurJaar, 0);
  return {
    rijen, vloerOpp, buitenOpp, parkeerplaatsen, nieuwbouwwaarde, markthuurJaar,
    metOppervlakte: vloerOpp > 0,
    // de kostenbenadering per zone telt pas als elke zone met oppervlakte ook een bouwprijs heeft
    // — anders zou een vergeten bouwprijs die zone stil op € 0 zetten
    metBouwprijs: rijen.some((r) => r.bouwprijsGetal > 0),
    zonderBouwprijs: rijen.filter((r) => r.oppGetal > 0 && !(r.bouwprijsGetal > 0)).map((r) => r.label),
    metMarkthuur: markthuurJaar > 0,
    zonderMarkthuur: rijen.filter((r) => r.oppGetal > 0 && !(r.markthuurGetal > 0) && r.functie !== "parking").map((r) => r.label),
  };
}

// huurwaardebenadering — zie de formules bovenaan. Percentages als getallen (7 = 7%).
export function berekenHuurwaarde({ markthuurJaar, leegstandPct = 0, kostenPct = 0, yieldPct, kostenKoperPct = 0, effectieveJaarhuur = 0 }) {
  const erv = getal(markthuurJaar), y = getal(yieldPct);
  const leeg = getal(leegstandPct), kost = getal(kostenPct), kk = getal(kostenKoperPct);
  const nettoHuur = erv * (1 - leeg / 100) * (1 - kost / 100);
  const investeringswaarde = y > 0 ? nettoHuur / (y / 100) : 0;
  const waarde = investeringswaarde / (1 + kk / 100);
  const eff = getal(effectieveJaarhuur);
  const waarschuwingen = [];
  if (erv > 0 && !(y > 0)) waarschuwingen.push("Vul het aanvangsrendement in om de huurwaarde te kapitaliseren.");
  if (erv > 0 && y > 0 && !(kk > 0)) waarschuwingen.push("De kosten koper staan op 0%: de waarde is dan de investeringswaarde (kosten koper inbegrepen).");
  if (y > 0 && (y < 3 || y > 15)) waarschuwingen.push(`Een aanvangsrendement van ${String(y).replace(".", ",")}% is ongebruikelijk voor bedrijfsvastgoed — controleer de invoer.`);
  const afwijking = erv > 0 && eff > 0 ? (eff - erv) / erv : null;
  if (afwijking !== null && Math.abs(afwijking) >= 0.1) {
    waarschuwingen.push(`De effectieve huur ligt ${Math.round(Math.abs(afwijking) * 100)}% ${afwijking > 0 ? "boven" : "onder"} de markthuur — motiveer in het verslag (looptijd, opzegmogelijkheden, huurder).`);
  }
  return {
    beschikbaar: erv > 0 && y > 0,
    markthuurJaar: erv, leegstandPct: leeg, kostenPct: kost, nettoHuur, yieldPct: y,
    investeringswaarde, kostenKoperPct: kk, waarde, effectieveJaarhuur: eff, afwijking, waarschuwingen,
  };
}

// tabel "Oppervlakte per functie" voor het verslag (PDF én voorbeeld): koppen, rijen en totalen.
// Kolommen zonder één ingevulde waarde (bv. geen enkele markthuur) vallen weg.
const fmtGetal = (n, dec = 0) => n.toLocaleString("nl-BE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtOpp = (n) => fmtGetal(Math.round(n * 10) / 10, Number.isInteger(Math.round(n * 10) / 10) ? 0 : 1);
export function zonesRapportTabel(zc) {
  const rijen = zc.rijen.filter((r) => r.oppGetal > 0);
  const metBouw = rijen.some((r) => r.bouwprijsGetal > 0), metHuur = rijen.some((r) => r.markthuurGetal > 0);
  const koppen = ["Functie", "Oppervlakte", ...(metBouw ? ["Nieuwbouw / eenh."] : []), ...(metHuur ? ["Markthuur / eenh. / jaar", "Markthuur / jaar"] : [])];
  const tabel = rijen.map((r) => [
    r.label, `${fmtOpp(r.oppGetal)} ${r.eenheid}`,
    ...(metBouw ? [r.bouwprijsGetal > 0 ? `€ ${fmtGetal(r.bouwprijsGetal)}` : "—"] : []),
    ...(metHuur ? [r.markthuurGetal > 0 ? `€ ${fmtGetal(r.markthuurGetal)}` : "—", r.huurJaar > 0 ? `€ ${fmtGetal(Math.round(r.huurJaar))}` : "—"] : []),
  ]);
  const totaal = [
    ["Overdekte vloeroppervlakte", zc.vloerOpp > 0 ? `${fmtOpp(zc.vloerOpp)} m²` : ""],
    ["Buitenopslag / verharding", zc.buitenOpp > 0 ? `${fmtOpp(zc.buitenOpp)} m²` : ""],
    ["Parkeerplaatsen", zc.parkeerplaatsen > 0 ? String(zc.parkeerplaatsen) : ""],
    ["Markthuur (som per functie)", zc.markthuurJaar > 0 ? `€ ${fmtGetal(Math.round(zc.markthuurJaar))} per jaar` : ""],
  ];
  return { koppen, rijen: tabel, totaal };
}
