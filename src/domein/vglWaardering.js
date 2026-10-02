// ----------------------------------------------------------------------------
// domein/vglWaardering.js — waardering volgens de vergelijkende methode (op basis van de VGL-punten)
// ----------------------------------------------------------------------------
// Uitgangspunten (bewust zo gekozen, zie ook de toelichting in de app):
//
// 1. Eenheid van vergelijking: prijs per m² GEWOGEN nuttige oppervlakte — dezelfde grootheid die
//    Vlabel levert ("gewogen vloeroppervlakte") en die het te schatten goed heeft ná coëfficiënten.
//
// 2. Grond wordt NIET mee in die m²-prijs verdeeld, maar enkel het VERSCHIL in perceeloppervlakte
//    wordt gecorrigeerd, aan de marginale grondprijs (standaard de laagste prijs per m² uit de
//    grondschijven van het dossier, d.i. meestal tuin/achterliggende grond). Reden: wie een
//    verkoop met 1.400 m² grond vergelijkt met een onderwerp op 800 m², betaalt voor die extra
//    600 m² tuinprijs, geen bouwgrondprijs. De volledige prijs splitsen aan een gemiddelde
//    grondprijs zou grote percelen systematisch te sterk corrigeren.
//
// 3. Tijd: optioneel een jaarlijkse marktevolutie (%) die de schatter zelf instelt en motiveert —
//    standaard 0 (geen indexering), zoals afgesproken.
//
// 4. Kwalitatieve verschillen (ligging, staat & afwerking, overige zoals EPC of bebouwingsvorm):
//    enkel als percentage dat de schatter-expert per punt zelf invult en motiveert. De app stelt
//    hier bewust GEEN percentages voor — dat is deskundig oordeel, geen rekenwerk.
//
// 5. Resultaat: gewogen gemiddelde van de gecorrigeerde m²-prijzen × de gewogen nuttige
//    oppervlakte van het te schatten goed. Daarnaast mediaan, spreiding en waarschuwingen
//    (te weinig punten, grote spreiding, uitschieters, groot verschil met de intrinsieke waarde).
//    Uitschieters worden gemeld, nooit stil weggelaten.
//
// 6. Lineaire schaling met de oppervlakte geldt enkel binnen een beperkte marge: grotere woningen
//    hebben doorgaans een lagere m²-prijs. Vandaar een waarschuwing bij meer dan 25% verschil.
// Pure functie: geen React/DOM — apart testbaar (zie __tests__/vglWaardering.test.js).

export const MIN_PUNTEN = 3;
export const MAX_SPREIDING = 0.15;        // variatiecoëfficiënt
export const UITSCHIETER = 0.25;          // afwijking t.o.v. de mediaan
export const MAX_AFWIJKING_INTRINSIEK = 0.15;
export const MAX_OPP_VERSCHIL_LINEAIR = 0.25;

const getal = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return isFinite(n) ? n : null;
};
const maandenTussen = (vanIso, totIso) => {
  const a = new Date(vanIso + "T00:00:00Z"), b = new Date(totIso + "T00:00:00Z");
  if (isNaN(a) || isNaN(b)) return null;
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + (b.getUTCDate() - a.getUTCDate()) / 31;
};
const mediaan = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// marginale grondprijs: laagste ingevulde prijs per m² uit de grondschijven
export function marginaleGrondprijs(schijven) {
  const prijzen = (schijven || []).map((s) => getal(s.prijs)).filter((p) => p !== null && p > 0);
  return prijzen.length ? Math.min(...prijzen) : null;
}

// d: (pand)dossier; ctx: { onderwerpOpp, onderwerpOppIsSchatting, intrinsiek, vandaagIso }
export function berekenVergelijkendeWaarde(d, ctx = {}) {
  const isAppartement = d.pandType === "Appartement";
  const onderwerpOpp = ctx.onderwerpOpp > 0 ? ctx.onderwerpOpp : null;
  const onderwerpGrond = isAppartement ? null : getal(d.grondopp) || getal(d.kadastraleOpp);
  const ingevuldeGrondprijs = getal(d.vglGrondcorrectiePrijs);
  const standaardGrondprijs = marginaleGrondprijs(d.schijven);
  const grondprijs = isAppartement ? null : (ingevuldeGrondprijs !== null ? ingevuldeGrondprijs : standaardGrondprijs);
  const marktevolutiePct = getal(d.vglMarktevolutiePct) || 0;
  const referentiedatum = d.referentiedatum || ctx.vandaagIso || new Date().toISOString().slice(0, 10);

  const punten = (d.vergelijkingspunten || []).map((v, i) => {
    const r = {
      id: v.id, nr: i + 1, adres: v.adres || "", bruikbaar: false, reden: "", opmerkingen: [],
      weging: v.weging === undefined || v.weging === "" ? 1 : Number(v.weging) || 0,
    };
    const prijs = getal(v.belastbareGrondslag);
    const opp = getal(v.nuttigeOpp);
    const grond = getal(v.grondOpp);
    if (r.weging <= 0) { r.reden = "telt niet mee (weging 0)"; return r; }
    if (!prijs || prijs <= 0) { r.reden = "geen prijs (belastbare grondslag) ingevuld"; return r; }
    if (!opp || opp <= 0) { r.reden = "gewogen nuttige oppervlakte ontbreekt"; return r; }
    r.prijs = prijs;
    r.opp = opp;

    // grondcorrectie: enkel het verschil, aan de marginale grondprijs
    r.grondcorrectie = 0;
    if (!isAppartement) {
      if (grond !== null && onderwerpGrond !== null && grondprijs !== null) {
        r.grondcorrectie = (onderwerpGrond - grond) * grondprijs;
        r.grondverschil = onderwerpGrond - grond;
      } else if (grond === null) {
        r.opmerkingen.push("perceeloppervlakte ontbreekt: grondverschil niet gecorrigeerd");
      }
    }
    const naGrond = prijs + r.grondcorrectie;
    if (naGrond <= 0) { r.reden = "de grondcorrectie is groter dan de prijs zelf — controleer grondprijs en perceeloppervlakte"; return r; }

    // tijdcorrectie (optioneel)
    r.maanden = v.datumTransactie ? maandenTussen(v.datumTransactie, referentiedatum) : null;
    r.tijdfactor = 1;
    if (marktevolutiePct && r.maanden !== null) r.tijdfactor = Math.pow(1 + marktevolutiePct / 100, r.maanden / 12);
    else if (marktevolutiePct && r.maanden === null) r.opmerkingen.push("geen transactiedatum: geen tijdcorrectie");

    r.prijsPerM2Basis = (naGrond * r.tijdfactor) / opp;
    r.correctiePct = (getal(v.correctieLigging) || 0) + (getal(v.correctieStaat) || 0) + (getal(v.correctieOverig) || 0);
    r.prijsPerM2 = r.prijsPerM2Basis * (1 + r.correctiePct / 100);
    r.motivering = v.correctieMotivering || "";
    if (r.correctiePct !== 0 && !r.motivering.trim()) r.opmerkingen.push("correctie zonder motivering");
    if (onderwerpOpp && Math.abs(opp - onderwerpOpp) / onderwerpOpp > MAX_OPP_VERSCHIL_LINEAIR) {
      r.opmerkingen.push(`oppervlakte wijkt meer dan ${Math.round(MAX_OPP_VERSCHIL_LINEAIR * 100)}% af — lineaire omrekening per m² is hier minder betrouwbaar`);
    }
    r.bruikbaar = true;
    return r;
  });

  const bruikbaar = punten.filter((p) => p.bruikbaar);
  const somW = bruikbaar.reduce((s, p) => s + p.weging, 0);
  const gemiddelde = somW ? bruikbaar.reduce((s, p) => s + p.prijsPerM2 * p.weging, 0) / somW : 0;
  const med = mediaan(bruikbaar.map((p) => p.prijsPerM2));
  const min = bruikbaar.length ? Math.min(...bruikbaar.map((p) => p.prijsPerM2)) : 0;
  const max = bruikbaar.length ? Math.max(...bruikbaar.map((p) => p.prijsPerM2)) : 0;
  const sd = bruikbaar.length > 1
    ? Math.sqrt(bruikbaar.reduce((s, p) => s + (p.prijsPerM2 - gemiddelde) ** 2, 0) / (bruikbaar.length - 1)) : 0;
  const spreiding = gemiddelde ? sd / gemiddelde : 0;
  for (const p of bruikbaar) {
    if (med && Math.abs(p.prijsPerM2 - med) / med > UITSCHIETER) {
      p.uitschieter = true;
      p.opmerkingen.push(`wijkt ${Math.round(Math.abs(p.prijsPerM2 - med) / med * 100)}% af van de mediaan — mogelijke uitschieter, te beoordelen`);
    }
  }

  const waarde = onderwerpOpp && gemiddelde ? gemiddelde * onderwerpOpp : 0;
  const waarschuwingen = [];
  if (!onderwerpOpp) waarschuwingen.push("De gewogen nuttige oppervlakte van het te schatten goed ontbreekt (tabblad Afmetingen): er kan nog geen waarde berekend worden.");
  else if (ctx.onderwerpOppIsSchatting) waarschuwingen.push("De oppervlakte van het te schatten goed is enkel een schatting, geen berekening na coëfficiënten — de vergelijking met de gewogen oppervlakte van de VGL-punten is daardoor minder zuiver.");
  if (bruikbaar.length > 0 && bruikbaar.length < MIN_PUNTEN) waarschuwingen.push(`Slechts ${bruikbaar.length} ${bruikbaar.length === 1 ? "bruikbaar vergelijkingspunt" : "bruikbare vergelijkingspunten"} (minimum ${MIN_PUNTEN}): de vergelijkende waarde is enkel indicatief.`);
  if (bruikbaar.length > 1 && spreiding > MAX_SPREIDING) waarschuwingen.push(`Grote spreiding tussen de gecorrigeerde m²-prijzen (variatiecoëfficiënt ${Math.round(spreiding * 100)}%): de punten zijn onderling weinig eensgezind — herbekijk de correcties of de keuze van de punten.`);
  if (!isAppartement && grondprijs === null) waarschuwingen.push("Geen grondprijs gekend (geen grondschijven en geen grondcorrectieprijs ingevuld): verschillen in perceeloppervlakte worden niet gecorrigeerd.");
  if (!isAppartement && onderwerpGrond === null) waarschuwingen.push("De grondoppervlakte van het te schatten goed ontbreekt: verschillen in perceeloppervlakte worden niet gecorrigeerd.");
  let afwijkingIntrinsiek = null;
  if (waarde && ctx.intrinsiek > 0) {
    afwijkingIntrinsiek = (waarde - ctx.intrinsiek) / ctx.intrinsiek;
    if (Math.abs(afwijkingIntrinsiek) > MAX_AFWIJKING_INTRINSIEK) {
      waarschuwingen.push(`De vergelijkende waarde wijkt ${Math.round(Math.abs(afwijkingIntrinsiek) * 100)}% af van de intrinsieke waarde: motiveer dit verschil in het verslag (bv. marktsituatie, staat, ligging).`);
    }
  }

  return {
    punten, aantal: bruikbaar.length, sommatieWeging: somW,
    gemiddeldePerM2: gemiddelde, mediaanPerM2: med, minPerM2: min, maxPerM2: max, spreiding,
    onderwerpOpp, onderwerpGrond, grondprijs, grondprijsIsStandaard: ingevuldeGrondprijs === null && grondprijs !== null,
    marktevolutiePct, waarde,
    waardeMin: onderwerpOpp ? min * onderwerpOpp : 0, waardeMax: onderwerpOpp ? max * onderwerpOpp : 0,
    afwijkingIntrinsiek, waarschuwingen,
    volwaardig: bruikbaar.length >= MIN_PUNTEN && !!waarde,
  };
}
