// ----------------------------------------------------------------------------
// domein/prijsvork.js — prijsvork (minimum – maximum) rond de venale waarde
// ----------------------------------------------------------------------------
// De venale waarde is één bedrag, maar elke waarderingsmethode in de app levert zelf al een
// uitkomst met een eigen onzekerheid op. De prijsvork brengt die uitkomsten samen volgens een vaste,
// in het verslag uitlegbare redenering:
//
//   1. Per methode een uitkomst en een bandbreedte:
//      - analytische methode: intrinsieke waarde (+ eventuele energiecorrectie), met de marktmarge
//        die de schatter-expert hanteert (standaard −5% / +5%) als bandbreedte;
//      - rendementsmethode (directe kapitalisatie): enkel de UITKOMST (het gemiddelde over het
//        gekozen yieldbereik, na eventuele transactiekosten) — bewust niet de waarden bij de
//        hoogste/laagste yield als bandbreedte: dat gaf een te brede vork;
//      - meerjaren-DCF: één uitkomst (geen eigen bandbreedte).
//   2. De bandbreedtes worden gecombineerd met DEZELFDE weging als de voorgestelde venale waarde zelf
//      (analytisch alleen, of het gemiddelde van analytisch en DCF) — zo ligt de vork altijd rond
//      de venale waarde en volgt ze dezelfde logica.
//   3. Lopen de methodes onderling verder uiteen dan die gecombineerde bandbreedte, dan wordt de
//      vork verruimd tot ze ALLE methode-uitkomsten omvat: dat verschil tussen de methodes is zelf
//      onzekerheid, en mag niet uit beeld verdwijnen.
//   4. De vork omvat altijd de venale waarde zelf (ook een manueel ingevulde); parkeerplaatsen/
//      garages tellen als vaste bedragen mee aan beide kanten.
//   5. Afgerond naar buiten op € 1.000.
// Niet in de vork: de gedwongen verkoopwaarde (een andere waardegrondslag) en de residuele
// grondwaarde (enkel grond). De schatter-expert kan de vork altijd manueel overschrijven.
// Bij een dossier met meerdere panden telt berekenTotaalPrijsvork (onderaan) de vorken per pand op.
// Pure functie — apart testbaar (zie __tests__/prijsvork.test.js).

export const AFRONDING = 1000;
export const BREDE_VORK = 0.20; // vanaf ±20% totale breedte t.o.v. de venale waarde: motiveren
// vaste vermelding in het verslag (ook bij een manueel bepaalde vork): de gedwongen verkoopwaarde
// hoort NIET in de prijsvork — ze steunt op een andere waardegrondslag
export const ZONDER_GEDWONGEN_VERKOOP = "De gedwongen verkoopwaarde maakt geen deel uit van de prijsvork: ze steunt op een andere waardegrondslag (verkoop onder tijdsdruk) en wordt apart vermeld.";

const getal = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return isFinite(n) ? n : null;
};

// calc: de (bijna) volledige uitkomst van berekenWaardering; d: het (pand)dossier
export function berekenPrijsvork(d, calc) {
  if (calc.rekenversie === 2 && calc.weging) return berekenPrijsvorkV2(d, calc);
  const methodes = [];
  const analytischCentrum = calc.intrinsiek + (calc.energiecorrectieBedrag || 0);
  if (analytischCentrum > 0) {
    methodes.push({
      sleutel: "analytisch",
      label: calc.isGarageStaanplaats ? "Waarde garage/staanplaats ± marktmarge" : "Analytische methode (intrinsieke waarde ± marktmarge)",
      centrum: analytischCentrum,
      onder: analytischCentrum * (1 - calc.marktMargeOnderPct / 100),
      boven: analytischCentrum * (1 + calc.marktMargeBovenPct / 100),
      toelichting: `marktmarge −${calc.marktMargeOnderPct}% / +${calc.marktMargeBovenPct}%`,
    });
  }
  const dcfDelen = [];
  if (calc.huurwaardeActief) {
    // bedrijfsvastgoed: de huurwaardebenadering (markthuur per zone gekapitaliseerd) vervangt de
    // directe kapitalisatie van één maandhuur — net als in de venale waarde (zie berekenWaardering)
    const h = calc.huurwaarde;
    const m = {
      sleutel: "huurwaarde",
      label: "Huurwaardebenadering (markthuur gekapitaliseerd)",
      centrum: h.waarde, onder: h.waarde, boven: h.waarde,
      toelichting: `uitkomst, aanvangsrendement ${String(h.yieldPct).replace(".", ",")}%${h.kostenKoperPct ? `, na ${String(h.kostenKoperPct).replace(".", ",")}% kosten koper` : ""}`,
    };
    methodes.push(m);
    dcfDelen.push(m);
  } else if (calc.dcfWaarde > 0 && calc.yieldRows && calc.yieldRows.length) {
    // enkel de uitkomst telt (geen bandbreedte uit de hoogste/laagste yield), zie stap 1 hierboven
    const yields = calc.yieldRows.map((r) => r.yield);
    const yieldTekst = yields.length > 1
      ? `gemiddelde over yield ${String(Math.min(...yields)).replace(".", ",")}% – ${String(Math.max(...yields)).replace(".", ",")}%`
      : `yield ${String(yields[0]).replace(".", ",")}%`;
    const m = {
      sleutel: "rendement",
      label: "Rendementsmethode (directe kapitalisatie)",
      centrum: calc.dcfWaardeNaTransactiekosten,
      onder: calc.dcfWaardeNaTransactiekosten,
      boven: calc.dcfWaardeNaTransactiekosten,
      toelichting: `uitkomst, ${yieldTekst}${calc.dcfTransactiekostenPct ? `, na ${calc.dcfTransactiekostenPct}% transactiekosten` : ""}`,
    };
    methodes.push(m);
    dcfDelen.push(m);
  }
  if (calc.dcfMeerjarenWaarde > 0) {
    const m = {
      sleutel: "meerjarenDcf", label: "Meerjaren-DCF", centrum: calc.dcfMeerjarenWaarde,
      onder: calc.dcfMeerjarenWaarde, boven: calc.dcfMeerjarenWaarde, toelichting: "één uitkomst",
    };
    methodes.push(m);
    dcfDelen.push(m);
  }

  // stap 2: zelfde weging als de voorgestelde venale waarde (zie berekenWaardering)
  const gem = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const analytisch = methodes.find((m) => m.sleutel === "analytisch");
  let gecombineerdOnder = 0, gecombineerdBoven = 0;
  if (analytisch && dcfDelen.length) {
    gecombineerdOnder = (analytisch.onder + gem(dcfDelen.map((m) => m.onder))) / 2;
    gecombineerdBoven = (analytisch.boven + gem(dcfDelen.map((m) => m.boven))) / 2;
  } else if (analytisch) {
    gecombineerdOnder = analytisch.onder;
    gecombineerdBoven = analytisch.boven;
  } else if (dcfDelen.length) {
    gecombineerdOnder = gem(dcfDelen.map((m) => m.onder));
    gecombineerdBoven = gem(dcfDelen.map((m) => m.boven));
  }

  // stap 3: verruimen tot alle methode-uitkomsten erin vallen
  const centra = methodes.map((m) => m.centrum);
  let onder = centra.length ? Math.min(gecombineerdOnder, ...centra) : 0;
  let boven = centra.length ? Math.max(gecombineerdBoven, ...centra) : 0;
  const verruimdOmMethodes = centra.length > 1 && (onder < gecombineerdOnder - 0.5 || boven > gecombineerdBoven + 0.5);

  // stap 4: de venale waarde (pand) moet erin liggen — ook een manueel ingevulde
  const waarschuwingen = [];
  const pand = calc.venaleWaardePand;
  let verruimdOmVenale = false;
  if (pand > 0 && (pand < onder || pand > boven)) {
    verruimdOmVenale = true;
    onder = Math.min(onder, pand);
    boven = Math.max(boven, pand);
    waarschuwingen.push("De manueel ingevulde venale waarde ligt buiten de uitkomsten van de methodes; de prijsvork werd tot die waarde verruimd. Motiveer de keuze voor deze waarde in het verslag.");
  }
  const parkeer = calc.parkeerTotaal || 0;
  const berekendOnder = onder > 0 ? Math.floor((onder + parkeer) / AFRONDING) * AFRONDING : 0;
  const berekendBoven = boven > 0 ? Math.ceil((boven + parkeer) / AFRONDING) * AFRONDING : 0;

  // manueel overschrijven (elk apart)
  const manOnder = getal(d.prijsvorkMin);
  const manBoven = getal(d.prijsvorkMax);
  const minimum = manOnder !== null ? manOnder : berekendOnder;
  const maximum = manBoven !== null ? manBoven : berekendBoven;
  const manueel = manOnder !== null || manBoven !== null;
  if (manueel) {
    if (minimum > maximum) waarschuwingen.push("Het minimum van de prijsvork is hoger dan het maximum.");
    else if (calc.venaleWaarde > 0 && (calc.venaleWaarde < minimum || calc.venaleWaarde > maximum)) waarschuwingen.push("De venale waarde ligt buiten de manueel ingevulde prijsvork.");
  }
  const breedte = calc.venaleWaarde > 0 && maximum > minimum ? (maximum - minimum) / calc.venaleWaarde : 0;
  if (breedte > BREDE_VORK && !manueel) {
    waarschuwingen.push(`De prijsvork is breed (${Math.round(breedte * 100)}% van de venale waarde)${verruimdOmMethodes ? " doordat de waarderingsmethodes onderling sterk verschillen" : ""} — motiveer in het verslag welke methode het zwaarst doorweegt en waarom.`);
  }

  const motivering = !methodes.length ? "" : [
    "De prijsvork werd bepaald op basis van de uitkomsten van de gehanteerde waarderingsmethodes:",
    methodes.map((m) => `${m.label.toLowerCase()} (${m.toelichting})`).join("; ") + ".",
    analytisch && dcfDelen.length
      ? `De bandbreedte van de analytische methode werd gecombineerd met de uitkomst van de ${calc.huurwaardeActief ? "huurwaardebenadering" : "rendementsbenadering"}, met dezelfde weging als de venale waarde (gemiddelde).`
      : "De bandbreedte volgt uit de gehanteerde methode.",
    verruimdOmMethodes ? "Omdat de methodes onderling verder uiteenlopen dan die bandbreedte, werd de vork verruimd zodat ze alle methode-uitkomsten omvat." : "",
    verruimdOmVenale ? "De vork werd verruimd tot de door de schatter-expert gekozen venale waarde." : "",
    parkeer ? "De waarde van de parkeerplaatsen/garages telt als vast bedrag mee." : "",
    "Afgerond op € 1.000.",
    ZONDER_GEDWONGEN_VERKOOP,
  ].filter(Boolean).join(" ");

  return {
    methodes, gecombineerdOnder, gecombineerdBoven, berekendOnder, berekendBoven,
    minimum, maximum, manueel, verruimdOmMethodes, verruimdOmVenale, breedte, waarschuwingen, motivering,
    beschikbaar: minimum > 0 && maximum > 0,
  };
}

// ---- rekenregels versie 2: gewogen methodes (zie domein/weging.js) ----
// Zelfde stappen als hierboven, maar met de weging die de schatter-expert hanteert: elke methode die
// meeweegt brengt haar bandbreedte in volgens haar gewicht; een methode met weging 0 is enkel een
// controle en blijft buiten de vork (ze wordt wel vermeld, met haar afwijking). Afgerond naar buiten
// op dezelfde stap als de venale waarde. De toelichting is geschreven zoals een schatter-expert ze
// zou formuleren, niet als een beschrijving van de berekening.
const nlPct = (v) => `${String(Math.round(v * 10) / 10).replace(".", ",")}%`;
const opsomming = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} en ${xs[xs.length - 1]}`);
const nlEur = (v) => `€ ${Math.round(v).toLocaleString("nl-BE")}`;
function berekenPrijsvorkV2(d, calc) {
  const bandVan = (m) => {
    if (m.sleutel === "kosten") return { onder: m.waarde * (1 - calc.marktMargeOnderPct / 100), boven: m.waarde * (1 + calc.marktMargeBovenPct / 100) };
    if (m.sleutel === "vergelijking" && calc.vergelijking && calc.vergelijking.onder > 0) return { onder: calc.vergelijking.onder, boven: calc.vergelijking.boven };
    return { onder: m.waarde, boven: m.waarde };
  };
  const toelichtingVan = (m) => {
    if (m.sleutel === "kosten") return `marktmarge −${nlPct(calc.marktMargeOnderPct)} / +${nlPct(calc.marktMargeBovenPct)}`;
    if (m.sleutel === "vergelijking") return calc.vergelijking && calc.vergelijking.aantal ? `spreiding van ${calc.vergelijking.aantal} gecorrigeerde referenties` : "uitkomst";
    if (calc.huurwaardeActief) return `aanvangsrendement ${nlPct(calc.huurwaarde.yieldPct)}`;
    return `${nlPct(calc.gemiddeldRendement || 0)} rendement${calc.dcfTransactiekostenPct ? `, na ${nlPct(calc.dcfTransactiekostenPct)} kosten koper` : ""}`;
  };
  // zelfde sleutels en (voor de bandbreedte) dezelfde benaming als in versie 1, zodat het verslag en
  // de schermen ze op dezelfde manier herkennen
  const SLEUTEL = { kosten: "analytisch", vergelijking: "vergelijking", rendement: calc.huurwaardeActief ? "huurwaarde" : "rendement" };
  const LABEL = {
    kosten: calc.isGarageStaanplaats ? "Waarde garage/staanplaats ± marktmarge" : "Analytische methode (intrinsieke waarde ± marktmarge)",
    vergelijking: "Vergelijkingsmethode (gecorrigeerde referenties)",
    rendement: calc.huurwaardeActief ? "Huurwaardebenadering (markthuur gekapitaliseerd)" : "Rendementsbenadering (directe kapitalisatie)",
  };
  const methodes = calc.weging.methodes.map((m) => ({
    sleutel: SLEUTEL[m.sleutel], label: LABEL[m.sleutel], naam: m.label, centrum: m.waarde, ...bandVan(m), gewicht: m.gewicht, controle: m.controle,
    toelichting: m.controle ? "ter controle, niet meegewogen" : `${Math.round(m.gewicht * 100)}%, ${toelichtingVan(m)}`,
  }));
  const meetellend = methodes.filter((m) => !m.controle);
  const controle = methodes.filter((m) => m.controle);
  let onder = meetellend.reduce((s, m) => s + m.gewicht * m.onder, 0);
  let boven = meetellend.reduce((s, m) => s + m.gewicht * m.boven, 0);
  const gecombineerdOnder = onder, gecombineerdBoven = boven;
  const centra = meetellend.map((m) => m.centrum);
  if (centra.length) { onder = Math.min(onder, ...centra); boven = Math.max(boven, ...centra); }
  const verruimdOmMethodes = centra.length > 1 && (onder < gecombineerdOnder - 0.5 || boven > gecombineerdBoven + 0.5);

  const waarschuwingen = [];
  const pand = calc.venaleWaardePand;
  let verruimdOmVenale = false;
  if (pand > 0 && (pand < onder || pand > boven)) {
    verruimdOmVenale = true;
    onder = Math.min(onder, pand);
    boven = Math.max(boven, pand);
    if (d.venaleWaarde !== "" && d.venaleWaarde !== undefined && d.venaleWaarde !== null) {
      waarschuwingen.push("De manueel ingevulde venale waarde ligt buiten de uitkomsten van de methodes; de prijsvork werd tot die waarde verruimd. Motiveer de keuze voor deze waarde in het verslag.");
    }
  }
  const stap = calc.afrondingStap || AFRONDING;
  const parkeer = calc.parkeerTotaal || 0;
  const berekendOnder = onder > 0 ? Math.floor((onder + parkeer) / stap) * stap : 0;
  const berekendBoven = boven > 0 ? Math.ceil((boven + parkeer) / stap) * stap : 0;

  const manOnder = getal(d.prijsvorkMin);
  const manBoven = getal(d.prijsvorkMax);
  const minimum = manOnder !== null ? manOnder : berekendOnder;
  const maximum = manBoven !== null ? manBoven : berekendBoven;
  const manueel = manOnder !== null || manBoven !== null;
  if (manueel) {
    if (minimum > maximum) waarschuwingen.push("Het minimum van de prijsvork is hoger dan het maximum.");
    else if (calc.venaleWaarde > 0 && (calc.venaleWaarde < minimum || calc.venaleWaarde > maximum)) waarschuwingen.push("De venale waarde ligt buiten de manueel ingevulde prijsvork.");
  }
  const breedte = calc.venaleWaarde > 0 && maximum > minimum ? (maximum - minimum) / calc.venaleWaarde : 0;
  if (breedte > BREDE_VORK && !manueel) {
    waarschuwingen.push(`De prijsvork is breed (${Math.round(breedte * 100)}% van de venale waarde)${verruimdOmMethodes ? " doordat de waarderingsmethodes onderling sterk verschillen" : ""} — motiveer in het verslag welke methode het zwaarst doorweegt en waarom.`);
  }
  const venale = calc.venaleWaardePand;
  controle.forEach((m) => {
    const afw = venale > 0 ? (m.centrum - venale) / venale : 0;
    m.afwijking = afw;
    if (Math.abs(afw) >= 0.15) waarschuwingen.push(`De ${m.naam.toLowerCase()} (${nlEur(m.centrum)}) wijkt ${Math.round(Math.abs(afw) * 100)}% af van de venale waarde — licht in het verslag toe waarom ze niet meeweegt.`);
  });

  const weegZin = meetellend.length === 1
    ? `De venale waarde steunt op de ${meetellend[0].naam.toLowerCase()}.`
    : `De venale waarde werd bepaald als gewogen gemiddelde van ${opsomming(meetellend.map((m) => `de ${m.naam.toLowerCase()} (${Math.round(m.gewicht * 100)}%)`))}.`;
  const bandZinnen = meetellend.map((m) => {
    if (m.sleutel === "analytisch") return calc.marktMargeOnderPct === calc.marktMargeBovenPct
      ? `Rond de intrinsieke waarde houden wij rekening met een marktmarge van ${nlPct(calc.marktMargeOnderPct)}.`
      : `Rond de intrinsieke waarde houden wij rekening met een marktmarge van −${nlPct(calc.marktMargeOnderPct)} tot +${nlPct(calc.marktMargeBovenPct)}${d.marktMargeMotivering ? ` (${String(d.marktMargeMotivering).trim().replace(/[.]$/, "")})` : ""}.`;
    if (m.sleutel === "vergelijking" && calc.vergelijking && calc.vergelijking.aantal) return `De vergelijkingspunten geven na correctie een spreiding van ${nlEur(calc.vergelijking.onder)} tot ${nlEur(calc.vergelijking.boven)}.`;
    return "";
  }).filter(Boolean);
  const controleZinnen = controle.map((m) => `Ter controle werd ook de ${m.naam.toLowerCase()} berekend (${nlEur(m.centrum)}${venale > 0 ? `, ${m.afwijking >= 0 ? "+" : "−"}${Math.round(Math.abs(m.afwijking) * 100)}% t.o.v. de venale waarde` : ""}); ${m.sleutel === "rendement" ? "voor een eigenaar-bewoond pand is de huurmarkt niet prijsbepalend, zodat deze benadering niet werd meegewogen" : "deze benadering werd niet meegewogen"}.`);
  const motivering = !methodes.length ? "" : [
    weegZin,
    "De prijsvork geeft de marge aan waarbinnen een verkoop onder normale omstandigheden redelijkerwijs kan worden verwacht.",
    ...bandZinnen,
    verruimdOmMethodes ? "Omdat de uitkomsten van de methodes verder uiteenliggen dan die marge, omvat de prijsvork alle meegewogen uitkomsten." : "",
    verruimdOmVenale && manueel === false && d.venaleWaarde ? "De prijsvork werd verruimd tot de door ons gekozen venale waarde." : "",
    parkeer ? "De parkeerplaatsen en garages tellen als vast bedrag mee." : "",
    ...controleZinnen,
    calc.toonGedwongenVerkoop === false ? "" : ZONDER_GEDWONGEN_VERKOOP,
  ].filter(Boolean).join(" ");

  return {
    methodes, gecombineerdOnder, gecombineerdBoven, berekendOnder, berekendBoven,
    minimum, maximum, manueel, verruimdOmMethodes, verruimdOmVenale, breedte, waarschuwingen, motivering,
    beschikbaar: minimum > 0 && maximum > 0,
  };
}

// Totale prijsvork over alle panden van een dossier (portefeuille): minimum = som van de minima,
// maximum = som van de maxima van de vork per pand (berekend of manueel). Dat is bewust de
// voorzichtige optelling: ze veronderstelt dat alle panden tegelijk aan dezelfde kant van hun vork
// uitkomen, wat bij panden in dezelfde markt en op dezelfde referentiedatum ook het realistische
// scenario is (één marktbeweging raakt ze allemaal). Parkeerplaatsen/garages zitten al in de vork
// van het hoofdpand (zie parkeerTotaal hierboven) en tellen dus niet nog eens mee.
// pandCalcs: de berekenWaardering-uitkomst per pand (hoofdpand eerst).
export function berekenTotaalPrijsvork(pandCalcs) {
  const vorken = (pandCalcs || []).map((c) => (c && c.prijsvork) || null);
  const ontbrekend = vorken.filter((v) => !v || !v.beschikbaar).length;
  const metVork = vorken.filter((v) => v && v.beschikbaar);
  const minimum = metVork.reduce((s, v) => s + v.minimum, 0);
  const maximum = metVork.reduce((s, v) => s + v.maximum, 0);
  const totaal = (pandCalcs || []).reduce((s, c) => s + ((c && c.venaleWaarde) || 0), 0);
  const waarschuwingen = [];
  if (ontbrekend && metVork.length) {
    waarschuwingen.push(`Voor ${ontbrekend === 1 ? "1 pand" : `${ontbrekend} panden`} is nog geen prijsvork beschikbaar; de totale vork is daardoor onvolledig.`);
  }
  const manueel = metVork.some((v) => v.manueel);
  const motivering = !metVork.length ? "" : [
    "De totale prijsvork is de som van de prijsvorken per pand (minimum = som van de minima, maximum = som van de maxima).",
    "Dat is een voorzichtige benadering: ze gaat ervan uit dat alle panden tegelijk aan dezelfde kant van hun vork uitkomen, wat bij panden in dezelfde markt en op dezelfde referentiedatum het realistische scenario is.",
    manueel ? "Voor minstens één pand werd de vork door de schatter-expert manueel bepaald." : "",
  ].filter(Boolean).join(" ");
  return {
    minimum, maximum, totaal, ontbrekend, manueel, waarschuwingen, motivering,
    beschikbaar: metVork.length > 0 && ontbrekend === 0,
  };
}
