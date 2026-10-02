// ----------------------------------------------------------------------------
// domein/vglWaardering.js — waardering volgens de vergelijkende methode (op basis van de VGL-punten)
// ----------------------------------------------------------------------------
// Per vergelijkingspunt rekent de app zelf een VOORGESTELDE WAARDE voor het te schatten goed uit,
// op dezelfde manier als de analytische methode: grond en gebouw apart.
//
//   1. grondwaarde van het VGL-punt  = zijn perceeloppervlakte, gewaardeerd met de grondschijven van
//      het te schatten goed (eerste schijf aan de eerste prijs, enz.; grond voorbij de laatste
//      schijf aan de prijs van de laatste schijf, d.i. meestal tuin/achterliggende grond);
//   2. gebouwwaarde van het VGL-punt = prijs (× eventuele marktevolutie) − die grondwaarde;
//   3. gebouwwaarde per m²           = gebouwwaarde / gewogen nuttige oppervlakte van het VGL-punt;
//   4. voorstel te schatten goed     = gebouwwaarde per m² × gewogen nuttige oppervlakte van het te
//                                      schatten goed + de grondwaarde van het te schatten goed (zoals
//                                      in de analytische methode).
//
// Zo schaalt enkel het gebouw mee met de oppervlakte (niet de grond), en wordt een groot of klein
// perceel correct verrekend. De schatter-expert stuurt bij met correcties in %:
//   - vetusteit en staat & afwerking werken op het GEBOUWDEEL (ouderdom en afwerking slaan op het
//     gebouw, niet op de grond);
//   - ligging en overige (bv. EPC) werken op het geheel.
// De app stelt zelf geen correctiepercentages voor: dat is deskundig oordeel.
//
// De vergelijkende waarde is het gewogen gemiddelde van die voorstellen. Daarnaast: mediaan,
// spreiding en waarschuwingen (te weinig punten, grote spreiding, uitschieters, groot verschil met
// de intrinsieke waarde). Uitschieters worden gemeld, nooit stil weggelaten.
// Pure functie: geen React/DOM — apart testbaar (zie __tests__/vglWaardering.test.js).

export const MIN_PUNTEN = 3;
export const MAX_SPREIDING = 0.15;        // variatiecoëfficiënt van de voorstellen
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

// bruikbare grondschijven (met een prijs), in hun volgorde
export function grondschijven(d) {
  return (d.schijven || [])
    .map((s) => ({ opp: getal(s.opp) || 0, prijs: getal(s.prijs) }))
    .filter((s) => s.prijs !== null && s.prijs > 0);
}

// Waarde van een perceel van "opp" m² volgens de grondschijven (in volgorde; voorbij de laatste
// schijf aan de prijs van de laatste schijf). null als er geen schijven met een prijs zijn.
export function grondwaardeVolgensSchijven(opp, schijven, factor = 1) {
  if (!schijven.length || opp === null || opp === undefined) return null;
  let rest = Math.max(0, opp), waarde = 0;
  for (const s of schijven) {
    if (rest <= 0) break;
    const deel = Math.min(rest, s.opp);
    waarde += deel * s.prijs;
    rest -= deel;
  }
  if (rest > 0) waarde += rest * schijven[schijven.length - 1].prijs;
  return waarde * factor;
}

// Voorstel voor het te schatten goed op basis van één verkoop — gedeeld door de VGL-punten
// (hieronder) en de Vlabel-lijst (indicatieve waarde vóór het overnemen, zie VlabelVglPaneel).
//  verkoop:   { prijs, opp (gewogen nuttige), grond (perceel, mag null), tijdfactor }
//  onderwerp: { opp, grondwaarde, schijven, grondFactor, isAppartement, grond }
//  correcties (in %): { vetusteit, staat, ligging, overig }
export function analytischVoorstel(verkoop, onderwerp, correcties = {}) {
  const opmerkingen = [];
  if (!(verkoop.prijs > 0)) return { bruikbaar: false, reden: "geen prijs (belastbare grondslag) ingevuld" };
  if (!(verkoop.opp > 0)) return { bruikbaar: false, reden: "gewogen nuttige oppervlakte ontbreekt" };
  if (!(onderwerp.opp > 0)) return { bruikbaar: false, reden: "gewogen nuttige oppervlakte van het te schatten goed ontbreekt" };

  const prijsNaTijd = verkoop.prijs * (verkoop.tijdfactor || 1);
  let grondVgl = 0, grondOnderwerp = 0;
  const grondApart = !onderwerp.isAppartement && onderwerp.schijven.length > 0;
  if (grondApart) {
    grondOnderwerp = onderwerp.grondwaarde || 0;
    if (verkoop.grond !== null && verkoop.grond !== undefined) {
      grondVgl = grondwaardeVolgensSchijven(verkoop.grond, onderwerp.schijven, onderwerp.grondFactor);
    } else {
      // perceel onbekend: zelfde grond als het te schatten goed verondersteld (geen grondverschil)
      grondVgl = grondOnderwerp;
      opmerkingen.push("perceeloppervlakte onbekend — dezelfde grondwaarde als het te schatten goed verondersteld");
    }
  }
  const gebouwVgl = prijsNaTijd - grondVgl;
  if (gebouwVgl <= 0) {
    return { bruikbaar: false, reden: "de grondwaarde volgens de grondschijven is hoger dan de prijs zelf — controleer de grondschijven en de perceeloppervlakte" };
  }
  const gebouwPerM2 = gebouwVgl / verkoop.opp;
  const gebouwOnderwerp = gebouwPerM2 * onderwerp.opp;
  const gebouwCorrPct = (getal(correcties.vetusteit) || 0) + (getal(correcties.staat) || 0);
  const totaalCorrPct = (getal(correcties.ligging) || 0) + (getal(correcties.overig) || 0);
  const gebouwOnderwerpNaCorr = gebouwOnderwerp * (1 + gebouwCorrPct / 100);
  const voorstelZonderCorrecties = gebouwOnderwerp + grondOnderwerp;
  const voorstel = (gebouwOnderwerpNaCorr + grondOnderwerp) * (1 + totaalCorrPct / 100);
  if (Math.abs(verkoop.opp - onderwerp.opp) / onderwerp.opp > MAX_OPP_VERSCHIL_LINEAIR) {
    opmerkingen.push(`oppervlakte wijkt meer dan ${Math.round(MAX_OPP_VERSCHIL_LINEAIR * 100)}% af — omrekening per m² gebouw is hier minder betrouwbaar`);
  }
  return {
    bruikbaar: true, prijsNaTijd, grondApart, grondVgl, gebouwVgl, gebouwPerM2, gebouwOnderwerp, grondOnderwerp,
    gebouwCorrPct, totaalCorrPct, gebouwOnderwerpNaCorr, voorstelZonderCorrecties, voorstel, opmerkingen,
  };
}

// het te schatten goed zoals analytischVoorstel het nodig heeft
export function onderwerpVoorVergelijking(d, ctx = {}) {
  const isAppartement = d.pandType === "Appartement";
  const schijven = isAppartement ? [] : grondschijven(d);
  const grondFactor = d.grondAandeelGemeenschapActief ? 1.12 : 1;
  return {
    isAppartement, schijven, grondFactor,
    opp: ctx.onderwerpOpp > 0 ? ctx.onderwerpOpp : null,
    grond: isAppartement ? null : getal(d.grondopp) || getal(d.kadastraleOpp),
    // grondwaarde van het te schatten goed: dezelfde als in de analytische methode
    grondwaarde: ctx.grondwaardeOnderwerp !== undefined ? ctx.grondwaardeOnderwerp
      : grondwaardeVolgensSchijven(schijven.reduce((s, x) => s + x.opp, 0), schijven, grondFactor) || 0,
  };
}

// d: (pand)dossier; ctx: { onderwerpOpp, onderwerpOppIsSchatting, intrinsiek, grondwaardeOnderwerp, vandaagIso }
export function berekenVergelijkendeWaarde(d, ctx = {}) {
  const o = onderwerpVoorVergelijking(d, ctx);
  const marktevolutiePct = getal(d.vglMarktevolutiePct) || 0;
  const referentiedatum = d.referentiedatum || ctx.vandaagIso || new Date().toISOString().slice(0, 10);

  const punten = (d.vergelijkingspunten || []).map((v, i) => {
    const basis = {
      id: v.id, nr: i + 1, adres: v.adres || "",
      weging: v.weging === undefined || v.weging === "" ? 1 : Number(v.weging) || 0,
      motivering: v.correctieMotivering || "",
    };
    if (basis.weging <= 0) return { ...basis, bruikbaar: false, reden: "telt niet mee (weging 0)", opmerkingen: [] };
    const maanden = v.datumTransactie ? maandenTussen(v.datumTransactie, referentiedatum) : null;
    const tijdfactor = marktevolutiePct && maanden !== null ? Math.pow(1 + marktevolutiePct / 100, maanden / 12) : 1;
    const r = analytischVoorstel(
      { prijs: getal(v.belastbareGrondslag), opp: getal(v.nuttigeOpp), grond: getal(v.grondOpp), tijdfactor },
      o,
      { vetusteit: v.correctieVetusteit, staat: v.correctieStaat, ligging: v.correctieLigging, overig: v.correctieOverig },
    );
    const opmerkingen = [...(r.opmerkingen || [])];
    if (r.bruikbaar && marktevolutiePct && maanden === null) opmerkingen.push("geen transactiedatum: geen tijdcorrectie");
    if (r.bruikbaar && (r.gebouwCorrPct || r.totaalCorrPct) && !basis.motivering.trim()) opmerkingen.push("correctie zonder motivering");
    return { ...basis, ...r, prijs: getal(v.belastbareGrondslag), opp: getal(v.nuttigeOpp), maanden, tijdfactor, opmerkingen };
  });

  const bruikbaar = punten.filter((p) => p.bruikbaar);
  const somW = bruikbaar.reduce((s, p) => s + p.weging, 0);
  const waarde = somW ? bruikbaar.reduce((s, p) => s + p.voorstel * p.weging, 0) / somW : 0;
  const med = mediaan(bruikbaar.map((p) => p.voorstel));
  const min = bruikbaar.length ? Math.min(...bruikbaar.map((p) => p.voorstel)) : 0;
  const max = bruikbaar.length ? Math.max(...bruikbaar.map((p) => p.voorstel)) : 0;
  const sd = bruikbaar.length > 1 ? Math.sqrt(bruikbaar.reduce((s, p) => s + (p.voorstel - waarde) ** 2, 0) / (bruikbaar.length - 1)) : 0;
  const spreiding = waarde ? sd / waarde : 0;
  for (const p of bruikbaar) {
    if (med && Math.abs(p.voorstel - med) / med > UITSCHIETER) {
      p.uitschieter = true;
      p.opmerkingen.push(`wijkt ${Math.round(Math.abs(p.voorstel - med) / med * 100)}% af van de mediaan — mogelijke uitschieter, te beoordelen`);
    }
  }

  const waarschuwingen = [];
  if (!o.opp) waarschuwingen.push("De gewogen nuttige oppervlakte van het te schatten goed ontbreekt (tabblad Afmetingen): er kan nog geen waarde berekend worden.");
  else if (ctx.onderwerpOppIsSchatting) waarschuwingen.push("De oppervlakte van het te schatten goed is enkel een schatting, geen berekening na coëfficiënten — de vergelijking met de gewogen oppervlakte van de VGL-punten is daardoor minder zuiver.");
  if (!o.isAppartement && !o.schijven.length) waarschuwingen.push("Er zijn nog geen grondschijven met een prijs ingevuld (tabblad Waardering): de grond wordt dan niet apart gewaardeerd en verschillen in perceeloppervlakte worden niet verrekend.");
  if (bruikbaar.length > 0 && bruikbaar.length < MIN_PUNTEN) waarschuwingen.push(`Slechts ${bruikbaar.length} ${bruikbaar.length === 1 ? "bruikbaar vergelijkingspunt" : "bruikbare vergelijkingspunten"} (minimum ${MIN_PUNTEN}): de vergelijkende waarde is enkel indicatief.`);
  if (bruikbaar.length > 1 && spreiding > MAX_SPREIDING) waarschuwingen.push(`Grote spreiding tussen de voorstellen (variatiecoëfficiënt ${Math.round(spreiding * 100)}%): de punten zijn onderling weinig eensgezind — vul correcties aan (vetusteit, staat, ligging) of herbekijk de keuze van de punten.`);
  let afwijkingIntrinsiek = null;
  if (waarde && ctx.intrinsiek > 0) {
    afwijkingIntrinsiek = (waarde - ctx.intrinsiek) / ctx.intrinsiek;
    if (Math.abs(afwijkingIntrinsiek) > MAX_AFWIJKING_INTRINSIEK) {
      waarschuwingen.push(`De vergelijkende waarde wijkt ${Math.round(Math.abs(afwijkingIntrinsiek) * 100)}% af van de intrinsieke waarde: motiveer dit verschil in het verslag (bv. marktsituatie, staat, ligging).`);
    }
  }

  return {
    punten, aantal: bruikbaar.length, sommatieWeging: somW,
    waarde, mediaan: med, min, max, spreiding,
    onderwerpOpp: o.opp, onderwerpGrond: o.grond, grondOnderwerp: o.grondwaarde, grondApart: !o.isAppartement && o.schijven.length > 0,
    marktevolutiePct, afwijkingIntrinsiek, waarschuwingen,
    volwaardig: bruikbaar.length >= MIN_PUNTEN && !!waarde,
  };
}
