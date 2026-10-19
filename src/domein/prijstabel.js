// ----------------------------------------------------------------------------
// domein/prijstabel.js — loten in één dossier: pand dupliceren + prijstabel
// ----------------------------------------------------------------------------
// Voor een blok van gelijkaardige loten (bv. 6 appartementen: GLV A/B, 1ste A/B, 2de A/B) wordt
// elk lot als een eigen pand gewaardeerd (zie extraPanden/maakLeegPand). Twee hulpmiddelen:
//   - dupliceerPand: kopieert alle pand-gegevens van een uitgewerkt lot naar een nieuw lot, zodat
//     per lot enkel aangepast moet worden wat verschilt (bus, verdieping, oppervlaktes, ...);
//   - bouwPrijstabel: de overzichtstabel zoals bij een nieuwbouwproject — per lot verdieping,
//     gewogen oppervlakte, slaapkamers, terras/tuin, venale waarde en prijsvork, met het totaal.
// Pure functies — apart testbaar (zie __tests__/prijstabel.test.js).
import { berekenTotaalPrijsvork } from "./prijsvork.js";

// worden bewust NIET mee gekopieerd: een nieuw lot krijgt een eigen id, en foto's/documenten
// zesmaal kopiëren maakt het dossier en de PDF onnodig zwaar (de PDF-server heeft een
// groottelimiet) — gemeenschappelijke foto's horen één keer bij het eerste lot
const NIET_KOPIEREN = ["pandId", "fotos", "documenten"];

// bron: het uitgewerkte pand (voor het hoofdpand: het dossier zelf), leeg: maakLeegPand() — de
// sleutels daarvan bepalen welke velden bij een pand horen (dossierbrede velden zoals opdracht-
// gever of schatter-expert gaan dus nooit mee). Lot en verdieping blijven leeg: die verschillen.
export function dupliceerPand(bron, leeg) {
  const kopie = { ...leeg };
  for (const sleutel of Object.keys(leeg)) {
    if (NIET_KOPIEREN.includes(sleutel) || !(sleutel in bron)) continue;
    const waarde = bron[sleutel];
    kopie[sleutel] = waarde && typeof waarde === "object" ? JSON.parse(JSON.stringify(waarde)) : waarde;
  }
  kopie.pandNaam = "";
  kopie.lotVerdieping = "";
  // een manueel overschreven venale waarde of prijsvork geldt voor dát lot alleen — meekopiëren
  // zou een ander lot (bv. het dakappartement) stil dezelfde waarde geven, ongeacht zijn eigen
  // oppervlaktes; het nieuwe lot rekent dus zelf
  for (const sleutel of ["venaleWaarde", "prijsvorkMin", "prijsvorkMax", "prijsvorkMotivering"]) {
    if (sleutel in leeg) kopie[sleutel] = leeg[sleutel];
  }
  return kopie;
}

const getal = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : 0; };

// één rij van de prijstabel. Waarde en prijsvork zonder de dossierbrede parkeerplaatsen/garages
// (die rekent berekenWaardering bij het hoofdpand), zodat elk lot zijn eigen waarde toont; die
// staan als aparte regel in de tabel en tellen wel mee in het totaal.
export function prijstabelRij(pd, calc, standaardLot) {
  const parkeer = calc.parkeerTotaal || 0;
  const buitenOpp = (pd.ruimtes || []).filter((r) => r.verdieping === "terras" || r.verdieping === "tuin")
    .reduce((s, r) => s + getal(r.opp), 0);
  const gewogenOpp = calc.totOppNaCoeff || 0;
  const waarde = calc.venaleWaardePand ?? ((calc.venaleWaarde || 0) - parkeer);
  const pv = calc.prijsvork && calc.prijsvork.beschikbaar ? calc.prijsvork : null;
  return {
    lot: pd.pandNaam || standaardLot,
    adres: pd.straat ? `${pd.straat} ${pd.nummer || ""}${pd.bus ? "/" + pd.bus : ""}`.trim() : "",
    verdieping: pd.lotVerdieping || "",
    type: (pd.vastgoedType || "") + (pd.vastgoedType === "Bedrijfsvastgoed" && pd.bedrijfsSubtype ? ` — ${pd.bedrijfsSubtype}` : ""),
    gewogenOpp,
    slaapkamers: (pd.slaapkamers || []).length,
    buitenOpp,
    venaleWaarde: waarde,
    prijsvork: pv ? { minimum: pv.minimum - parkeer, maximum: pv.maximum - parkeer } : null,
    perM2: gewogenOpp > 0 ? waarde / gewogenOpp : 0,
  };
}

// panden: [{ pd, calc }] met het hoofdpand eerst. opties.parkeerTotaal: de dossierbrede
// parkeerplaatsen/garages (berekenParkeerplaatsenTotaal) — bij meerdere panden zitten die in geen
// enkel pand (zie berekenWaardering) en komen ze hier als aparte regel bij het totaal en de vork.
export function bouwPrijstabel(panden, opties = {}) {
  let rijen = panden.map(({ pd, calc }, i) => prijstabelRij(pd, calc, i === 0 ? "Hoofdpand" : `Pand ${i + 1}`));
  // loten in één gebouw (zelfde straat en huisnummer): enkel het busnummer tonen i.p.v. telkens
  // het volledige adres
  const gebouw = (pd) => `${pd.straat || ""} ${pd.nummer || ""}`.trim();
  if (panden.length > 1 && gebouw(panden[0].pd) && panden.every(({ pd }) => gebouw(pd) === gebouw(panden[0].pd))) {
    rijen = rijen.map((r, i) => ({ ...r, adres: panden[i].pd.bus ? `bus ${panden[i].pd.bus}` : "" }));
  }
  // parkeerplaatsen die al in een pand verrekend zitten (één pand) + de dossierbrede (meerdere panden)
  const inPanden = panden.reduce((s, { calc }) => s + (calc.parkeerTotaal || 0), 0);
  const apart = opties.parkeerTotaal || 0;
  const parkeerTotaal = inPanden + apart;
  const totaal = rijen.reduce((s, r) => s + r.venaleWaarde, 0) + parkeerTotaal;
  const totaalOpp = rijen.reduce((s, r) => s + r.gewogenOpp, 0);
  const vork = berekenTotaalPrijsvork(panden.map(({ calc }) => calc));
  // vaste bedragen: aan beide kanten van de vork, net als bij één pand (zie berekenPrijsvork)
  const totaleVork = apart > 0 && vork.beschikbaar
    ? { ...vork, minimum: vork.minimum + apart, maximum: vork.maximum + apart, motivering: `${vork.motivering} De parkeerplaatsen/garages tellen als vast bedrag mee.` }
    : vork;
  // gemengd dossier (bv. woning + garage): het vastgoedtype per lot is dan informatief
  const gemengd = new Set(rijen.map((r) => r.type)).size > 1;
  return { rijen, parkeerTotaal, totaal, totaalOpp, totaleVork, gemengd };
}
