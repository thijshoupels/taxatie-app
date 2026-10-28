// ----------------------------------------------------------------------------
// domein/controles.js — inhoudelijke controles vóór aflevering
// ----------------------------------------------------------------------------
// valideerDossier (App.jsx) kijkt of de VERPLICHTE velden ingevuld zijn. Deze controles kijken of
// wat ingevuld is ook KLOPT met elkaar — precies de tegenstrijdigheden die een advocaat van de
// tegenpartij er meteen uithaalt: halfopen bebouwing maar 4 gevels in de berekening, twee
// verschillende bewoonbare oppervlaktes, agrarisch gebied met een verkaveling, een SWOT die een
// gegeven tegelijk kans en bedreiging noemt, een asymmetrische marge zonder uitleg, ...
// Elke controle geeft een korte zin met het tabblad waar het rechtgezet wordt. Ze blokkeren niets.
// Pure functie — apart testbaar (zie __tests__/controles.test.js).
import { isResidentieelType } from "./vastgoedtypes.js";

const getal = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : 0; };
const leeg = (v) => !String(v ?? "").trim();
const nl = (v) => String(Math.round(v * 100) / 100).replace(".", ",");

export const GEVELS_PER_BOUWTYPE = { Open: "4-gevel", Halfopen: "3-gevel", Gesloten: "2-gevel" };
// grenzen voor coëfficiënten van niet-bewoonbare ruimtes (KAVEX-bandbreedtes, zie VERDIEPINGEN)
const COEFF_MAX = { tuinberging: 0.4, kelder: 0.6, zolder: 0.7 };
const NIET_WOONZONES = ["Agrarisch gebied", "Industriegebied"];

export function inhoudelijkeControles(d, calc) {
  const uit = [];
  const residentieel = isResidentieelType(d);
  const woning = residentieel && (d.pandType || "Woning") === "Woning";

  // 1. bouwtype en gevels (de gevels sturen de ABEX-berekening)
  const verwacht = GEVELS_PER_BOUWTYPE[d.bouwtype];
  if (woning && verwacht && d.gevel && d.gevel !== verwacht && !(calc && calc.isNieuwbouwtabel)) {
    uit.push(`Bouwtype "${d.bouwtype}" en "${d.gevel}" in de berekening spreken elkaar tegen (${d.bouwtype.toLowerCase()} = ${verwacht}) — tabblad Type, staat & kadaster en Markt`);
  }

  // 2. twee bewoonbare oppervlaktes
  const schatting = getal(d.bewoonbareOppSchatting);
  const berekend = calc ? calc.totOppNaCoeff : 0;
  if (residentieel && schatting > 0 && berekend > 0 && Math.abs(schatting - berekend) / berekend > 0.1) {
    uit.push(`Twee bewoonbare oppervlaktes: ${nl(schatting)} m² (schatting) en ${nl(berekend)} m² (berekend, basis van de waardering) — pas de schatting aan of licht het verschil toe — tabblad Afmetingen`);
  }

  // 3. bestemming
  if (residentieel && NIET_WOONZONES.includes(d.gewestplan)) {
    if (d.verkaveling === "Ja") uit.push(`${d.gewestplan} én een verkaveling: dat gaat zelden samen — controleer op Geopunt of er een RUP of BPA geldt — tabblad Markt`);
    if (!["Ja", "Nee"].includes(d.zonevreemd)) uit.push(`Woning in ${d.gewestplan.toLowerCase()}: geef aan of ze zonevreemd is — tabblad Markt`);
  }
  if (d.zonevreemd === "Ja" && leeg(d.zonevreemdToelichting)) {
    uit.push("Zonevreemde woning: licht de gevolgen toe (uitbreidingsmogelijkheden, herbouw, vergunningen van bijgebouwen en zwembad) — tabblad Markt");
  }

  // 4. coëfficiënten van niet-bewoonbare ruimtes en een ontbrekende garage
  for (const r of d.ruimtes || []) {
    const max = COEFF_MAX[r.verdieping];
    if (max && getal(r.coeff) > max) uit.push(`Coëfficiënt ${nl(getal(r.coeff))} voor ${r.naam || r.verdieping} ligt hoog (gangbaar tot ${nl(max)}) — tabblad Afmetingen`);
  }
  const garageEig = d.eigenschappen && d.eigenschappen.garage;
  const garageVermeld = garageEig && ((garageEig.items || []).some((x) => /garage/i.test(x)) || getal(garageEig.aantal) > 0);
  if (residentieel && garageVermeld && !(d.ruimtes || []).some((r) => r.verdieping === "garage") && !(d.parkeerplaatsenGarages || []).length) {
    uit.push("Er is een garage vermeld, maar ze staat niet in de oppervlaktetabel en niet bij de parkeerplaatsen/garages — tabblad Afmetingen");
  }

  // 5. onderbouwing van de kostenbenadering
  if (calc && residentieel && !(calc.isGarageStaanplaats) && leeg(d.bouwprijsBasis)) {
    uit.push("Vermeld of de eenheidsprijs per m² inclusief of exclusief btw en erelonen is — tabblad Waardering");
  }
  const bouwjaarOnbekend = leeg(d.bouwjaar) || d.bouwjaar === "Onbekend";
  if (calc && calc.totaalVetusiteit > 0 && bouwjaarOnbekend && leeg(d.vetusteitMotivering)) {
    uit.push(`Vetusteit van ${nl(calc.totaalVetusiteit)}% terwijl het bouwjaar onbekend is: motiveer de vetusteit (bv. per bouwdeel: schil, technieken, afwerking) — tabblad Waardering`);
  }
  if (calc && calc.marktMargeOnderPct !== calc.marktMargeBovenPct && leeg(d.marktMargeMotivering)) {
    uit.push(`Asymmetrische marktmarge (−${nl(calc.marktMargeOnderPct)}% / +${nl(calc.marktMargeBovenPct)}%) zonder toelichting — tabblad Waardering`);
  }

  // 6. SWOT die zichzelf of de invoer tegenspreekt
  const swot = { sterktes: d.sterktes, zwaktes: d.zwaktes, kansen: d.kansen, bedreigingen: d.bedreigingen };
  const tekst = (k) => String(swot[k] || "").toLowerCase();
  for (const term of ["agrarisch", "zonevreemd", "bestemming", "verhuur", "renovatie"]) {
    const positief = ["sterktes", "kansen"].filter((k) => tekst(k).includes(term));
    const negatief = ["zwaktes", "bedreigingen"].filter((k) => tekst(k).includes(term));
    if (positief.length && negatief.length) uit.push(`De SWOT noemt "${term}" zowel bij ${positief.join("/")} als bij ${negatief.join("/")} — kies één kant of verwoord het verschil — tabblad SWOT`);
  }
  const negatieveKeuring = /(ontbrek|geen)[a-z ]{0,20}keuring|keuring[a-z ]{0,20}(ontbreekt|ontbrekend)/;
  if (d.keuringStatus !== "Keuring niet aanwezig" && (negatieveKeuring.test(tekst("zwaktes")) || negatieveKeuring.test(tekst("bedreigingen")))) {
    uit.push(`De SWOT spreekt van een ontbrekende elektrische keuring, maar bij de installaties staat "${d.keuringStatus || "niets"}" — tabblad SWOT of Verwarming & installaties`);
  }
  // 7. vorm: stukken zonder omschrijving, AI-omgevingsgegevens niet nagekeken, echtscheiding
  const zonderOmschrijving = (d.documenten || []).filter((x) => leeg(x.omschrijving)).length;
  if (zonderOmschrijving) uit.push(`${zonderOmschrijving} geraadpleegd${zonderOmschrijving > 1 ? "e stukken hebben" : " stuk heeft"} geen omschrijving — in het verslag staat dan enkel de bestandsnaam — tabblad Documenten`);
  if (d.liggingOpgezochtAdres && !d.liggingNagekeken) uit.push("De omgevingsgegevens werden via AI opgezocht en zijn nog niet als nagekeken bevestigd — tabblad Ligging & omgeving");
  if (d.reden === "Echtscheiding") {
    if (leeg(d.echtAnderePartij)) uit.push("Echtscheiding: vermeld of de andere partij op de hoogte was van het plaatsbezoek — tabblad Opdracht & partijen");
    if (leeg(d.echtVraagstelling)) uit.push("Echtscheiding: noteer de exacte vraagstelling van notaris of advocaat (bv. ook de waarde zonder de werken?) — tabblad Opdracht & partijen");
    if (d.echtEigendom === "Eigen goed van één partner" && !(getal(d.echtWaardeZonderWerken) > 0)) uit.push("Echtscheiding met een eigen goed: de notaris-vereffenaar kan ook de waarde zonder de (met gemeenschapsgeld uitgevoerde) werken nodig hebben — tabblad Opdracht & partijen");
    if (calc && calc.toonGedwongenVerkoop) uit.push("Echtscheiding: de gedwongen verkoopwaarde staat in het verslag — dat geeft de partij die het pand overneemt een lager ankerpunt — tabblad Waardering");
  }
  return uit;
}
