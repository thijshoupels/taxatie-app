// ----------------------------------------------------------------------------
// domein/waardering.js — de waarderingsrekenmodule + het gedeelde rapportmodel
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 2) zonder de rekenlogica zelf te
// wijzigen: berekenWaardering/berekenParkeerplaatsenTotaal zijn de pure (React-loze) rekenkern,
// useCalc is de React-hook eromheen (useDeferredValue/useMemo, zie audit punt M1), en de drie
// "GEDEELD RAPPORTMODEL"-functies leveren de platte gegevens die zowel de PDF (buildPandSections)
// als de scherm-voorvertoning (StepRapport) identiek opbouwen — zie de toelichting bij die functies
// hieronder voor de achtergrond (het voorkomt dat PDF en scherm weer uit elkaar lopen).
import { useDeferredValue, useMemo } from "react";
import { num, eur, pct, nlDate } from "../lib/format.js";
import { KLASSEN, ABEX_INDEX_1998, GEVEL_FACTOR } from "../constants.js";

// Som van "aantal × waarde per stuk" over de dossierbrede lijst parkeerplaatsen/garages (zie
// initialData.parkeerplaatsenGarages) — bewust een kleine, zelfstandige functie los van
// berekenWaardering() hieronder: dit blijft een eenvoudige, rechttoe-rechtaan optelsom die geen
// van de bestaande ABEX-/vetusiteit-/DCF-berekeningen (en hun tests) raakt. Het resultaat wordt
// bovenop de venale waarde van elk pand geteld voor het dossierbrede totaal (zie
// "Portefeuille-overzicht" in StepWaardering/het rapport).
export function berekenParkeerplaatsenTotaal(lijst) {
  return (lijst || []).reduce((som, p) => som + num(p.aantal) * num(p.waardePerStuk), 0);
}

// Pure rekenfunctie, losgekoppeld van React (geen hooks) — dit maakt de rekenmodule op zich
// testbaar (zie de Vitest-tests in src/__tests__/) zonder een component te moeten renderen, en
// is ook wat useCalc() hieronder nu binnenin useMemo/useDeferredValue aanroept.
export function berekenWaardering(d) {
    const ruimteRows = d.ruimtes.map((r) => ({ ...r, oppNaCoeff: num(r.opp) * num(r.coeff) }));
    // aandeel gemeenschappelijke delen (bv. traphal/gangen bij een appartement): telt volledig mee
    // (coëff. 1) bovenop de individuele ruimtes, zodat dit mee getaxeerd wordt via de ABEX-waarde
    const gemeenschappelijkeDelenOpp = num(d.gemeenschappelijkeDelenOpp);
    const totOpp = ruimteRows.reduce((s, r) => s + num(r.opp), 0) + gemeenschappelijkeDelenOpp;
    const totOppNaCoeff = ruimteRows.reduce((s, r) => s + r.oppNaCoeff, 0) + gemeenschappelijkeDelenOpp;
    const ratio = totOpp > 0 ? totOppNaCoeff / totOpp : 0;
    // effectief grondaandeel bij een appartement: het aandeel (in 1000sten) van de totale
    // grondoppervlakte van de residentie/het complex (ingevuld bij "Grondoppervlakte")
    const effectiefGrondaandeel = d.aandeelDuizendsten !== "" ? (num(d.grondopp) * num(d.aandeelDuizendsten)) / 1000 : 0;

    const klasseObj = KLASSEN.find((k) => k.label === d.klasse) || KLASSEN[0];
    const gevelN = parseInt(d.gevel) || 2;
    const gevelFactor = GEVEL_FACTOR[gevelN] || 1;
    const abexPerM2 = (klasseObj.basis1998 * gevelFactor) / ABEX_INDEX_1998 * num(d.abexIndexHuidig);
    const nieuwbouwwaardeAbex = abexPerM2 * totOppNaCoeff;

    const gemVetusiteit = (num(d.vetOuderdom) + num(d.vetFrequentie) + num(d.vetGebruik) + num(d.vetKwaliteit)) / 4;
    const actueleWaardeGebouwAbex = nieuwbouwwaardeAbex * (1 - gemVetusiteit / 100);

    // bij KMO-vastgoed/Bedrijfsvastgoed vervangt de manueel ingeschatte vervangingswaarde (zie
    // StepBedrijfskenmerken) de ABEX-berekening hierboven: de KLASSEN-tabel (basis1998) is
    // opgemaakt voor woningen/appartementen en niet gekalibreerd voor bedrijfsmatig vastgoed
    // (magazijn, kantoor, winkelpand, ...) — een schatter-expert vult daarom zelf de reeds-
    // afgeschreven vervangingswaarde in i.p.v. dat de app een niet-onderbouwde bedrijfsmatige
    // kostprijs/m² zou verzinnen. Vetusiteit zit in dat geval al verrekend in het ingegeven bedrag.
    // let op: "d.vastgoedType !== 'Residentieel'" zou ook een ONTBREKEND vastgoedType (bv. een
    // dossier van vóór deze functionaliteit, of een test die het veld niet meegeeft) als niet-
    // residentieel behandelen — vandaar expliciet aftoetsen tegen de twee niet-residentiële
    // waarden, net als "isResidentieel" bij StepType/DossierWizard/buildReportData.
    const gebruiktBedrijfsVervangingswaarde =
      (d.vastgoedType === "KMO-vastgoed" || d.vastgoedType === "Bedrijfsvastgoed") && d.bedrijfsVervangingswaarde !== "";
    const nieuwbouwwaarde = gebruiktBedrijfsVervangingswaarde ? num(d.bedrijfsVervangingswaarde) : nieuwbouwwaardeAbex;
    const actueleWaardeGebouw = gebruiktBedrijfsVervangingswaarde ? num(d.bedrijfsVervangingswaarde) : actueleWaardeGebouwAbex;

    const grondwaardeBasis = d.schijven.reduce((s, sc) => s + num(sc.opp) * num(sc.prijs), 0);
    const totaleGrondopp = d.schijven.reduce((s, sc) => s + num(sc.opp), 0);
    // ---- optionele extra: grond — "aandeel gemeenschap" (+12%) ----
    // Zelfde vuistregel-gedachte als gemeenschappelijkeDelenVuistregelActief bij de afmetingen
    // (zie StepAfmetingen), maar hier doorlopend toegepast op de berekende grondwaarde per schijf
    // i.p.v. eenmalig op een manueel veld — staat standaard uit.
    const grondAandeelGemeenschapBedrag = d.grondAandeelGemeenschapActief ? grondwaardeBasis * 0.12 : 0;
    const grondwaarde = grondwaardeBasis + grondAandeelGemeenschapBedrag;

    const intrinsiek = actueleWaardeGebouw + grondwaarde;
    // marge rond de intrinsieke waarde (standaard 5% onder én boven, maar elk apart naar wens
    // overschrijfbaar via d.marktMargeOnderPct / d.marktMargeBovenPct — bv. voor een pand met een
    // minder liquide markt kan een schatter-expert een ruimere of engere, en niet noodzakelijk
    // symmetrische, bandbreedte willen hanteren dan de standaard 5%/5%)
    const marktMargeOnderPct = d.marktMargeOnderPct !== "" ? num(d.marktMargeOnderPct) : 5;
    const marktMargeBovenPct = d.marktMargeBovenPct !== "" ? num(d.marktMargeBovenPct) : 5;
    const marktOnder = intrinsiek * (1 - marktMargeOnderPct / 100);
    const marktBoven = intrinsiek * (1 + marktMargeBovenPct / 100);

    const yieldRows = [];
    const jaarhuur = num(d.huurMaand) * 10; // conform Excel: "Jaarlijkse huurprijs (10m huur)"
    const van = num(d.yieldVan), tot = num(d.yieldTot);
    // De stap komt uit een vrij invoerveld. Een negatief getal liet de lus aftellen — die eindigde
    // dan nooit en bevroor het tabblad; een extreem kleine stap leverde tienduizenden rijen op met
    // hetzelfde gevolg. Beide gebeurden tijdens het tekenen van het scherm, dus vóór de autosave
    // kon draaien: het recentste werk was daardoor weg. Vandaar de absolute waarde, een ondergrens
    // en een harde begrenzing op het aantal rijen.
    const stap = Math.min(Math.max(Math.abs(num(d.yieldStap)) || 0.5, 0.05), 10);
    if (van > 0 && tot >= van && jaarhuur > 0) {
      for (let y = van; y <= tot + 1e-9 && yieldRows.length < 200; y += stap) {
        yieldRows.push({ yield: y, waarde: jaarhuur / (y / 100) });
      }
    }
    const dcfWaarde = yieldRows.length ? yieldRows.reduce((s, r) => s + r.waarde, 0) / yieldRows.length : 0;

    // ---- optionele extra: transactiekosten-minwaarde op de (gewone) DCF-waarde hierboven ----
    // Staat standaard uit en telt dan nergens in mee. De schatter-expert vult zelf het percentage
    // in (richtwaarde 12%-14% registratierechten/notariskosten/hypotheekkosten, zie StepWaardering)
    // — dit beïnvloedt enkel de DCF-waarde/het rapportblok "Rendementsbenadering (DCF)", niet de
    // venale waarde zelf (net als de andere optionele extra's hieronder).
    const dcfTransactiekostenPct = d.dcfTransactiekostenActief && d.dcfTransactiekostenPct !== "" ? num(d.dcfTransactiekostenPct) : 0;
    const dcfTransactiekostenBedrag = dcfTransactiekostenPct !== 0 ? dcfWaarde * (dcfTransactiekostenPct / 100) : 0;
    const dcfWaardeNaTransactiekosten = dcfWaarde - dcfTransactiekostenBedrag;

    // ---- optionele extra 1: energiecorrectie (EPC) ----
    // Staat standaard uit en telt dan nergens in mee. Eenmaal door de schatter-expert aangevinkt,
    // telt het percentage dat hij/zij zelf intypt mee in de VOORGESTELDE venale waarde hieronder —
    // maar het veld "Venale waarde" blijft altijd manueel overschrijfbaar, dus het laatste woord
    // blijft bij de schatter-expert. Er wordt nergens automatisch een percentage voorgesteld/
    // ingevuld; StepWaardering toont wel een louter informatieve richtwaarde als leeswijzer.
    const energiecorrectiePct = d.energiecorrectieActief && d.energiecorrectiePct !== "" ? num(d.energiecorrectiePct) : 0;
    const energiecorrectieBedrag = energiecorrectiePct !== 0 ? intrinsiek * (energiecorrectiePct / 100) : 0;

    const venaleWaardePand = d.venaleWaarde !== "" ? num(d.venaleWaarde) : (intrinsiek + energiecorrectieBedrag);
    // Parkeerplaatsen/garages (dossierbrede lijst d.parkeerplaatsenGarages) tellen voortaan mee in
    // de venale waarde zelf, i.p.v. enkel als een aparte pagina in het rapport te verschijnen — dit
    // was een expliciet gemelde fout: de waarde van garages/staanplaatsen moet mee bepalend zijn
    // voor "de" venale waarde, niet louter een extra vermelding achteraf.
    const parkeerTotaal = berekenParkeerplaatsenTotaal(d.parkeerplaatsenGarages);
    const venaleWaarde = venaleWaardePand + parkeerTotaal;
    // gedwongen verkoopwaarde staat los van de rendementsbenadering (DCF): ze wordt toegepast op
    // de (uiteindelijke) venale waarde — dus inclusief parkeerplaatsen/garages (bevestigd met de
    // schatter-expert: de gedwongen-verkoopfactor slaat op het totaal, niet enkel op het pand) — en
    // blijft dus ook beschikbaar wanneer er geen DCF/yield-berekening is (bv. geen huurgegevens
    // ingevuld) — voorheen viel deze op "n.v.t." zodra er geen DCF-waarde was, wat niet correct is
    // aangezien een gedwongen verkoop een apart waarderingsgegeven is, los van de
    // rendementsbenadering
    const gedwongenVerkoop = venaleWaarde * num(d.gedwongenFactor);

    // ---- optionele extra 2: meerjaren-DCF ----
    // Zuiver informatief, naast (niet in plaats van) de bestaande directe-kapitalisatiemethode
    // hierboven (dcfWaarde) — beïnvloedt de venale waarde niet. Enkel actief na expliciete keuze
    // van de schatter-expert, die ook elke aanname (huurgroei, leegstand, discontovoet, exit-yield)
    // zelf instelt.
    let dcfMeerjarenWaarde = 0;
    const dcfJaren = Math.max(1, Math.round(num(d.dcfJaren) || 10));
    const dcfExitYieldPct = d.dcfExitYieldPct !== "" ? num(d.dcfExitYieldPct) : (van > 0 && tot >= van ? (van + tot) / 2 : 0);
    if (d.dcfMeerjarenActief && jaarhuur > 0 && num(d.dcfDiscontovoetPct) > 0) {
      const groei = num(d.dcfHuurgroeiPct), leegstand = num(d.dcfLeegstandPct), disconto = num(d.dcfDiscontovoetPct);
      let pv = 0;
      let huurJaarN = jaarhuur;
      for (let j = 1; j <= dcfJaren; j++) {
        pv += (huurJaarN * (1 - leegstand / 100)) / Math.pow(1 + disconto / 100, j);
        huurJaarN = huurJaarN * (1 + groei / 100);
      }
      if (dcfExitYieldPct > 0) {
        const eindwaarde = huurJaarN / (dcfExitYieldPct / 100); // gekapitaliseerde huur van jaar N+1
        pv += eindwaarde / Math.pow(1 + disconto / 100, dcfJaren);
      }
      dcfMeerjarenWaarde = pv;
    }

    // ---- optionele extra 3: residuele methode (grondwaarde bij herontwikkelingspotentieel) ----
    // Wordt enkel getoond/gebruikt naast de gewone grondwaarde per schijf hierboven, nooit erover
    // heen — de schatter-expert beslist zelf welke van de twee in het dossier relevant is.
    let residueleGrondwaarde = 0;
    if (d.residueelActief) {
      const eindwaardeNaOntwikkeling = num(d.residueelEindwaarde);
      const bouwkost = num(d.residueelBouwkost);
      const bijkomendeKosten = bouwkost * (num(d.residueelBijkomendeKostenPct) / 100);
      const winstmarge = eindwaardeNaOntwikkeling * (num(d.residueelWinstmargePct) / 100);
      residueleGrondwaarde = eindwaardeNaOntwikkeling - bouwkost - bijkomendeKosten - winstmarge;
    }

    // Voordien: "totOpp > 0 && num(d.grondopp) >= 0" — die tweede voorwaarde is ALTIJD waar (num("")
    // geeft 0), dus het groene "gegevens consistent" betekende in de praktijk enkel "er staat ergens
    // een oppervlakte". Nu benoemen we wat er effectief nog ontbreekt, zodat het vinkje iets zegt.
    const residentieel = d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed";
    const controlePunten = [];
    if (!(totOpp > 0)) controlePunten.push("geen enkele ruimte met oppervlakte ingevuld");
    if (!(totOppNaCoeff > 0)) controlePunten.push("oppervlakte na coëfficiënten is 0");
    if (!(venaleWaarde > 0)) controlePunten.push("venale waarde is nog 0");
    if (residentieel && !(num(d.grondopp) > 0)) controlePunten.push("grondoppervlakte ontbreekt");
    if (residentieel && !gebruiktBedrijfsVervangingswaarde && !(abexPerM2 > 0)) {
      controlePunten.push("klasse/gevel leveren geen ABEX-waarde per m² op");
    }
    const oppCheck = controlePunten.length === 0;

    return {
      ruimteRows, totOpp, totOppNaCoeff, ratio, gemeenschappelijkeDelenOpp, effectiefGrondaandeel,
      klasseObj, gevelFactor, abexPerM2, nieuwbouwwaarde,
      gemVetusiteit, actueleWaardeGebouw, gebruiktBedrijfsVervangingswaarde,
      grondwaarde, grondwaardeBasis, grondAandeelGemeenschapBedrag, totaleGrondopp, intrinsiek, marktMargeOnderPct, marktMargeBovenPct, marktOnder, marktBoven,
      yieldRows, jaarhuur, dcfWaarde, gedwongenVerkoop, venaleWaarde, venaleWaardePand, parkeerTotaal, oppCheck, controlePunten,
      dcfTransactiekostenPct, dcfTransactiekostenBedrag, dcfWaardeNaTransactiekosten,
      energiecorrectiePct, energiecorrectieBedrag,
      dcfMeerjarenWaarde, dcfJaren, dcfExitYieldPct,
      residueleGrondwaarde,
    };
}

export function useCalc(d) {
  // useDeferredValue laat React de herberekening op lagere prioriteit uitvoeren zodat typen in
  // om het even welk van de ~150 dossier-velden vlot blijft aanvoelen, ook wanneer de rekenmodule
  // (Abex, vetusiteit, DCF, meerjaren-DCF, residuele methode...) verder aangroeit — het scherm
  // toont dan heel even de vorige berekende waarden verder tot de nieuwe klaar zijn, in plaats van
  // elke toetsaanslag te laten wachten op een volledige herberekening (zie audit, punt M1).
  const deferredD = useDeferredValue(d);
  return useMemo(() => berekenWaardering(deferredD), [deferredD]);
}

// ----------------------------------------------------------------------------
// GEDEELD RAPPORTMODEL
// ----------------------------------------------------------------------------
// Vóór deze functies bouwden de PDF (buildPandSections, HTML-strings) en de scherm-voorvertoning
// (StepRapport, JSX) elk apart en met een licht andere structuur exact dezelfde rijen op — twee
// plekken die bij elke aanpassing manueel in sync moesten blijven. Dat ging al één keer mis: de
// PDF kreeg een "Bron"-kolom bij de vergelijkingspunten, de scherm-voorvertoning niet (zie de
// toelichting bij StepVergelijkingspunten). Deze drie functies leveren enkel platte gegevens
// (geen HTML, geen JSX) op basis van het dossier + de berekening, zodat buildPandSections dat
// omzet naar wTable(...)-HTML en StepRapport naar <ReportGrid rows={...}/> — maar de eigenlijke
// rijen, labels en getallen kunnen zo onmogelijk nog uit elkaar lopen.
export function rapportVergelijkingspuntRijen(v) {
  return [
    ["Adres", v.adres], ["Kadastrale gegevens", v.kadastraleGegevens], ["Bouwjaar", v.bouwjaar],
    ["Aard transactie", v.aardTransactie], ["Datum transactie", nlDate(v.datumTransactie)],
    ["Bron", v.bron],
    ["Belastbare grondslag", v.belastbareGrondslag ? eur(num(v.belastbareGrondslag)) : ""],
    ["Ligging", v.ligging], ["Bestemming", v.bestemming], ["Oriëntatie", v.oriëntatie],
    ["Externe afwerking", v.externeAfwerking], ["Onderhoud", v.onderhoud],
    ["Rooilijnbreedte", v.rooilijnbreedte ? `${v.rooilijnbreedte} m` : ""],
    ["Gevelbreedte", v.gevelbreedte ? `${v.gevelbreedte} m` : ""],
    ["Bebouwde oppervlakte", v.bebouwdeOpp ? `${v.bebouwdeOpp} m²` : ""],
    ["Afweging t.o.v. het te schatten pand", v.afweging],
  ];
}

// Levert de opeenvolgende waarderingsblokken op ({titel, rijen, motivering?}) — telkens in
// dezelfde volgorde en met dezelfde voorwaarden (optioneel actief, wel/niet residentieel) als
// voorheen apart geïmplementeerd in buildPandSections en StepRapport.
export function rapportWaarderingsBlokken(d, calc) {
  const isResidentieel = d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed";
  const blokken = [];

  blokken.push({ titel: "Waardering op basis van vervangingswaarde", rijen: [
    ...(!isResidentieel
      ? [["Vervangingswaarde (manueel ingeschat)", calc.gebruiktBedrijfsVervangingswaarde ? eur(calc.actueleWaardeGebouw) : ""]]
      : [["Klasse", d.klasse], ["Gevel", d.gevel], ["Abex-waarde/m²", eur(calc.abexPerM2)],
         ["Gemiddelde vetusiteit", pct(calc.gemVetusiteit)]]),
    ["Intrinsieke waarde", eur(calc.intrinsiek)],
    [`Geschatte marktwaarde (-${pct(calc.marktMargeOnderPct)} / +${pct(calc.marktMargeBovenPct)})`, `${eur(calc.marktOnder)} – ${eur(calc.marktBoven)}`],
  ] });

  if (calc.dcfWaarde > 0) {
    const dcfRijen = [["DCF-waarde", eur(calc.dcfWaarde)]];
    // optionele minwaarde voor transactiekosten (registratierechten, notariskosten, hypotheekkosten)
    if (d.dcfTransactiekostenActief && calc.dcfTransactiekostenPct !== 0) {
      dcfRijen.push(["Transactiekosten", `-${pct(calc.dcfTransactiekostenPct)} (${eur(calc.dcfTransactiekostenBedrag)})`]);
      dcfRijen.push(["DCF-waarde na transactiekosten", eur(calc.dcfWaardeNaTransactiekosten)]);
    }
    blokken.push({
      titel: "Rendementsbenadering (DCF)", rijen: dcfRijen,
      motivering: (d.dcfTransactiekostenActief && calc.dcfTransactiekostenPct !== 0) ? (d.dcfTransactiekostenMotivering || "") : "",
    });
  }

  // meerjaren-DCF, residuele grondwaarde en energiecorrectie zijn alle drie optionele extra's,
  // enkel actief na expliciete keuze van de schatter-expert (zie StepWaardering/StepAfmetingen)
  if (d.dcfMeerjarenActief && calc.dcfMeerjarenWaarde > 0) {
    blokken.push({ titel: "Meerjaren-DCF (optioneel)", motivering: d.dcfMotivering || "", rijen: [
      ["Aantal jaren", d.dcfJaren], ["Huurgroei", pct(num(d.dcfHuurgroeiPct))], ["Leegstand", pct(num(d.dcfLeegstandPct))],
      ["Discontovoet", pct(num(d.dcfDiscontovoetPct))], ["Exit-yield", pct(calc.dcfExitYieldPct)],
      ["Meerjaren-DCF-waarde", eur(calc.dcfMeerjarenWaarde)],
    ] });
  }

  if (d.residueelActief) {
    blokken.push({ titel: "Residuele grondwaarde (optioneel)", motivering: d.residueelMotivering || "", rijen: [
      ["Verwachte eindwaarde na (her)ontwikkeling", eur(num(d.residueelEindwaarde))],
      ["Geraamde bouw-/sloopkost", eur(num(d.residueelBouwkost))],
      ["Bijkomende kosten", pct(num(d.residueelBijkomendeKostenPct))], ["Ontwikkelaarswinst/risico", pct(num(d.residueelWinstmargePct))],
      ["Residuele grondwaarde", eur(calc.residueleGrondwaarde)],
    ] });
  }

  // gedwongen verkoop staat bewust los van de rendementsbenadering (DCF) — het is een apart
  // waarderingsgegeven op basis van de venale waarde, en verschijnt dus altijd, ook zonder DCF
  blokken.push({ titel: "Gedwongen verkoop", rijen: [
    ["Gedwongen-verkoopfactor", d.gedwongenFactor], ["Gedwongen verkoopwaarde", eur(calc.gedwongenVerkoop)],
  ] });

  if (d.energiecorrectieActief && calc.energiecorrectiePct !== 0) {
    blokken.push({ titel: "Energiecorrectie (optioneel)", motivering: d.energiecorrectieMotivering || "", rijen: [
      ["Correctie", pct(calc.energiecorrectiePct)], ["Correctiebedrag", eur(calc.energiecorrectieBedrag)],
    ] });
  }

  // Parkeerplaatsen/garages: dit blok toont de opbouw van de venale waarde hierboven (pand +
  // parkeerplaatsen/garages = venale waarde) — het staat bewust ALS ONDERDEEL van de gewone
  // Waardering-sectie (zowel op het scherm via StepRapport als in de PDF via buildPandSections),
  // niet langer als een aparte pagina/sectie verderop in het rapport.
  if (calc.parkeerTotaal > 0) {
    blokken.push({ titel: "Parkeerplaatsen & garages", rijen: [
      ...(d.parkeerplaatsenGarages || []).map((p) => [
        `${p.type}${p.omschrijving ? ` — ${p.omschrijving}` : ""} (${p.aantal || 0}×)`,
        eur(num(p.aantal) * num(p.waardePerStuk)),
      ]),
      ["Waarde pand (excl. parkeerplaatsen/garages)", eur(calc.venaleWaardePand)],
      ["Totaal parkeerplaatsen/garages", eur(calc.parkeerTotaal)],
    ] });
  }

  return blokken;
}

// GEEN terugval op datumVerslag: is de referentiedatum niet ingevuld, dan mag het verslag géén
// andere datum als referentiedatum tonen. Bij een nalatenschap is dat de datum van overlijden, en
// die bepaalt de waarde — stilzwijgend de datum van het verslag tonen maakt van een vergeten veld
// een inhoudelijk onjuist document.
export function rapportVenaleWaardeZin(d) {
  return `${d.referentiedatum ? `Referentiedatum: ${nlDate(d.referentiedatum)} — ` : ""}De geschatte waarde is de normale venale waarde, zijnde de prijs die vermoedelijk kan worden bekomen bij een normale verkoop onder normale omstandigheden.`;
}
