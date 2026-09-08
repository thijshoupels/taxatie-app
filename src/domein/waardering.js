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
    // de nieuwbouwprijzen-tabel voor appartementen (waardePerM2Nieuwbouw, zie constants.js) drukt al
    // de volledige, actuele prijs per m² uit — rechtstreeks herrekend uit reële Immoweb-publicaties,
    // niet vanaf een 1998-basiswaarde die nog geschaald moet worden. De gevelfactor is voor die
    // tabel bewust genegeerd (op vraag van de schatter-expert: bij een appartement weegt het aantal
    // gevels van het gebouw weinig door, in tegenstelling tot een woning) — vandaar gevelFactor = 1
    // in dat geval, ongeacht d.gevel. De klassieke Abex-tabel (woningen, en de oorspronkelijke
    // appartementsklassen die er nog naast blijven bestaan) gebruikt ongewijzigd de gevelfactor +
    // 1998-indexschaling hieronder.
    const isNieuwbouwtabel = typeof klasseObj.waardePerM2Nieuwbouw === "number";
    const gevelFactor = isNieuwbouwtabel ? 1 : (GEVEL_FACTOR[gevelN] || 1);
    // valt de afwerking tussen twee klassen in, dan kiest de schatter-expert een tweede klasse
    // (d.klasse2) en een mengverhouding (d.klasseMixPct, gewicht van klasse2 in %) i.p.v. verplicht
    // één van de twee te moeten kiezen — bv. 60% "Gewoon huis" / 40% "Verzorgd/comfortabel". Zonder
    // klasse2 (het gangbare geval) blijft dit exact het bestaande gedrag: basisWaardeEffectief =
    // klasseObj.basis1998 (of .waardePerM2Nieuwbouw hierboven, bij de nieuwbouwprijzen-tabel).
    // "|| d.klasse2" i.p.v. een undefined-check: een dossier van vóór deze functionaliteit (of een
    // test die het veld niet meegeeft) heeft géén klasse2 en moet zich exact als voorheen gedragen.
    const klasse2Label = d.klasse2 || "";
    const klasseObj2 = klasse2Label ? KLASSEN.find((k) => k.label === klasse2Label) : null;
    const klasseMixPct = klasseObj2 ? Math.min(100, Math.max(0, num(d.klasseMixPct ?? 50) || 0)) : 0;
    // "?? " i.p.v. "||": beide tabellen gebruiken een ander veld (basis1998 vs. waardePerM2Nieuwbouw)
    // om dezelfde "waarde van deze klasse"-rol te vervullen — welk van de twee aanwezig is, bepaalt
    // isNieuwbouwtabel hierboven (op basis van klasseObj, de EERSTE klasse; de tweede-klasse-keuze
    // in StepWaardering laat toe enkel dezelfde soort klasse te combineren).
    const klasseWaarde1 = klasseObj.waardePerM2Nieuwbouw ?? klasseObj.basis1998;
    const klasseWaarde2 = klasseObj2 ? (klasseObj2.waardePerM2Nieuwbouw ?? klasseObj2.basis1998) : null;
    const basisWaardeEffectief = klasseObj2
      ? (klasseWaarde1 * (100 - klasseMixPct) + klasseWaarde2 * klasseMixPct) / 100
      : klasseWaarde1;
    const abexPerM2Berekend = isNieuwbouwtabel
      ? basisWaardeEffectief
      : (basisWaardeEffectief * gevelFactor) / ABEX_INDEX_1998 * num(d.abexIndexHuidig);
    // manuele override van de Abex-waarde/m² zelf (bv. wanneer geen van de KLASSEN-rijen, ook niet
    // gemengd, goed past) — vetusiteit hieronder blijft wél verrekend, in tegenstelling tot
    // bedrijfsVervangingswaarde verderop (die al de reeds-afgeschreven waarde is). Zelfde
    // "|| ''"-vangnet als hierboven voor een dossier zonder dit veld.
    const abexPerM2Override = d.abexPerM2Override || "";
    const abexPerM2 = abexPerM2Override !== "" ? num(abexPerM2Override) : abexPerM2Berekend;
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

    // vastgoedType "Garage / Staanplaats": een eigen, sterk vereenvoudigde waardering i.p.v. de
    // ABEX-klasse/gevel/vetusiteit-berekening hierboven (opgemaakt voor woningen/appartementen) of
    // de manueel ingeschatte bedrijfsvervangingswaarde — geen van beide is relevant/gekalibreerd
    // voor een kale garage(box)/staanplaats/carport/berging. De schatter-expert kiest zelf de
    // methode (zie OPTS.garageWaarderingsMethode/StepWaardering): "Aantal × prijs per stuk" (bv.
    // een reeks losse garageboxen) of "Prijs per m² × oppervlakte" (oppervlakte = totOppNaCoeff
    // hierboven, dezelfde "Oppervlakte per bouweenheid"-tabel bij Afmetingen als bij elk ander
    // vastgoedtype). Dit is iets anders dan de dossierbrede parkeerplaatsenGarages-lijst (zie
    // berekenParkeerplaatsenTotaal hierboven): die is een AANVULLING op een gewoon pand, dit hier
    // is de volledige, enige waardering van het pand zelf.
    const isGarageStaanplaats = d.vastgoedType === "Garage / Staanplaats";
    const garageMethodeM2 = d.garageWaarderingsMethode === "Prijs per m² × oppervlakte";
    const garageWaarde = isGarageStaanplaats
      ? (garageMethodeM2 ? num(d.garagePrijsPerM2) * totOppNaCoeff : num(d.garageAantal) * num(d.garagePrijsPerStuk))
      : 0;

    const nieuwbouwwaarde = isGarageStaanplaats ? garageWaarde
      : gebruiktBedrijfsVervangingswaarde ? num(d.bedrijfsVervangingswaarde) : nieuwbouwwaardeAbex;
    const actueleWaardeGebouw = isGarageStaanplaats ? garageWaarde
      : gebruiktBedrijfsVervangingswaarde ? num(d.bedrijfsVervangingswaarde) : actueleWaardeGebouwAbex;

    const grondwaardeBasis = d.schijven.reduce((s, sc) => s + num(sc.opp) * num(sc.prijs), 0);
    const totaleGrondopp = d.schijven.reduce((s, sc) => s + num(sc.opp), 0);
    // ---- optionele extra: grond — "aandeel gemeenschap" (+12%) ----
    // Zelfde vuistregel-gedachte als gemeenschappelijkeDelenVuistregelActief bij de afmetingen
    // (zie StepAfmetingen), maar hier doorlopend toegepast op de berekende grondwaarde per schijf
    // i.p.v. eenmalig op een manueel veld — staat standaard uit.
    const grondAandeelGemeenschapBedrag = d.grondAandeelGemeenschapActief ? grondwaardeBasis * 0.12 : 0;
    // bij een appartement is de grondwaarde per schijf hierboven optioneel geworden: de
    // nieuwbouwprijzen-tabel (waardePerM2Nieuwbouw) is afgeleid uit reële verkoopprijzen, die het
    // grondaandeel al impliciet bevatten — die dan óók nog eens optellen zou dubbel tellen. Bij een
    // woning blijft de grondwaarde ONVOORWAARDELIJK meetellen (ongewijzigd bestaand gedrag): enkel
    // "d.pandType === 'Appartement'" maakt het toggle-baar. Backward-compat: "!== false" i.p.v. een
    // waarheidscheck — een dossier van vóór deze functionaliteit (of een test die het veld niet
    // meegeeft) heeft géén grondwaardeMeetellenBijAppartement en moet zich exact als voorheen
    // gedragen (grondwaarde blijft meetellen, ook bij een appartement).
    const grondwaardeMeetellen = d.pandType !== "Appartement" || d.grondwaardeMeetellenBijAppartement !== false;
    const grondwaarde = grondwaardeMeetellen ? (grondwaardeBasis + grondAandeelGemeenschapBedrag) : 0;

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
    // — dit verrekent als minwaarde op de DCF-waarde, en werkt zo (via dcfWaardeNaTransactiekosten
    // hieronder) door in de DCF-samenstelling die mee de venale waarde bepaalt, zie verderop.
    const dcfTransactiekostenPct = d.dcfTransactiekostenActief && d.dcfTransactiekostenPct !== "" ? num(d.dcfTransactiekostenPct) : 0;
    const dcfTransactiekostenBedrag = dcfTransactiekostenPct !== 0 ? dcfWaarde * (dcfTransactiekostenPct / 100) : 0;
    const dcfWaardeNaTransactiekosten = dcfWaarde - dcfTransactiekostenBedrag;

    // ---- optionele extra: meerjaren-DCF ----
    // Naast (niet in plaats van) de directe-kapitalisatiemethode hierboven (dcfWaarde) — enkel
    // actief na expliciete keuze van de schatter-expert, die ook elke aanname (huurgroei,
    // leegstand, discontovoet, exit-yield) zelf instelt. Verplaatst vóór de venale waarde
    // hieronder, want telt er nu (samen met dcfWaarde) mee in, zie dcfSamengesteld verderop.
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

    // ---- DCF meegerekend in de venale waarde ----
    // Op vraag van de schatter-expert telt de DCF voortaan mee in de VOORGESTELDE venale waarde
    // hieronder, i.p.v. louter informatief te blijven. Beide DCF-benaderingen — de directe
    // kapitalisatie hierboven (dcfWaarde, ná een eventuele transactiekosten-minwaarde) én de
    // meerjaren-DCF hierboven — tellen daarbij samen mee: dcfSamengesteld is hun gemiddelde
    // wanneer beide aanwezig zijn, of gewoon de ene die er is. Dit gebeurt enkel wanneer er
    // effectief DCF-gegevens zijn ingevuld (dcfWaarde > 0 en/of dcfMeerjarenWaarde > 0) — zonder
    // huurgegevens blijft dcfSamengesteld op 0, en verandert er dus niets aan de voorgestelde
    // venale waarde (die blijft dan zoals voorheen: intrinsieke waarde + energiecorrectie).
    const dcfComponenten = [];
    if (dcfWaarde > 0) dcfComponenten.push(dcfWaardeNaTransactiekosten);
    if (dcfMeerjarenWaarde > 0) dcfComponenten.push(dcfMeerjarenWaarde);
    const dcfSamengesteld = dcfComponenten.length
      ? dcfComponenten.reduce((s, v) => s + v, 0) / dcfComponenten.length
      : 0;

    // ---- optionele extra 1: energiecorrectie (EPC) ----
    // Staat standaard uit en telt dan nergens in mee. Eenmaal door de schatter-expert aangevinkt,
    // telt het percentage dat hij/zij zelf intypt mee in de VOORGESTELDE venale waarde hieronder —
    // maar het veld "Venale waarde" blijft altijd manueel overschrijfbaar, dus het laatste woord
    // blijft bij de schatter-expert. Er wordt nergens automatisch een percentage voorgesteld/
    // ingevuld; StepWaardering toont wel een louter informatieve richtwaarde als leeswijzer.
    const energiecorrectiePct = d.energiecorrectieActief && d.energiecorrectiePct !== "" ? num(d.energiecorrectiePct) : 0;
    const energiecorrectieBedrag = energiecorrectiePct !== 0 ? intrinsiek * (energiecorrectiePct / 100) : 0;

    // De voorgestelde venale waarde is, zolang er DCF-gegevens zijn (dcfSamengesteld > 0), het
    // gemiddelde van de intrinsieke waarde (+ energiecorrectie) en de samengestelde DCF-waarde
    // hierboven — anders (geen huurgegevens ingevuld) exact zoals voorheen: enkel de intrinsieke
    // waarde + energiecorrectie. Het veld "Venale waarde" blijft, zoals altijd, manueel
    // overschrijfbaar: dit bepaalt enkel wat er als VOORGESTELDE waarde verschijnt.
    const intrinsiekPlusEnergiecorrectie = intrinsiek + energiecorrectieBedrag;
    const voorgesteldeVenaleWaarde = dcfSamengesteld > 0
      ? (intrinsiekPlusEnergiecorrectie + dcfSamengesteld) / 2
      : intrinsiekPlusEnergiecorrectie;
    const venaleWaardePand = d.venaleWaarde !== "" ? num(d.venaleWaarde) : voorgesteldeVenaleWaarde;
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
    // "residentieel" hier moet ook "Garage / Staanplaats" uitsluiten (net als bij KMO-vastgoed/
    // Bedrijfsvastgoed): grondoppervlakte en een ABEX-waarde/m² zijn bij dat vastgoedtype evenmin
    // van toepassing/verplicht — zie isGarageStaanplaats hierboven.
    const residentieel = !isGarageStaanplaats && d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed";
    const controlePunten = [];
    // de twee oppervlakte-checks hieronder gelden niet bij "Garage / Staanplaats": bij de methode
    // "Aantal × prijs per stuk" (zie garageWaarde hierboven) hoeft er geen oppervlakte ingevuld te
    // zijn — "waarde garage/staanplaats is nog niet ingevuld" hieronder dekt beide methodes al.
    if (!isGarageStaanplaats && !(totOpp > 0)) controlePunten.push("geen enkele ruimte met oppervlakte ingevuld");
    if (!isGarageStaanplaats && !(totOppNaCoeff > 0)) controlePunten.push("oppervlakte na coëfficiënten is 0");
    if (!(venaleWaarde > 0)) controlePunten.push("venale waarde is nog 0");
    if (residentieel && !(num(d.grondopp) > 0)) controlePunten.push("grondoppervlakte ontbreekt");
    if (residentieel && !gebruiktBedrijfsVervangingswaarde && !(abexPerM2 > 0)) {
      controlePunten.push("klasse/gevel leveren geen ABEX-waarde per m² op");
    }
    if (isGarageStaanplaats && !(garageWaarde > 0)) controlePunten.push("waarde garage/staanplaats is nog niet ingevuld");
    const oppCheck = controlePunten.length === 0;

    return {
      ruimteRows, totOpp, totOppNaCoeff, ratio, gemeenschappelijkeDelenOpp, effectiefGrondaandeel,
      klasseObj, klasseObj2, klasseMixPct, isNieuwbouwtabel, abexPerM2Override, gevelFactor, abexPerM2, nieuwbouwwaarde,
      gemVetusiteit, actueleWaardeGebouw, gebruiktBedrijfsVervangingswaarde,
      isGarageStaanplaats, garageMethodeM2, garageWaarde,
      grondwaarde, grondwaardeBasis, grondAandeelGemeenschapBedrag, grondwaardeMeetellen, totaleGrondopp, intrinsiek, marktMargeOnderPct, marktMargeBovenPct, marktOnder, marktBoven,
      yieldRows, jaarhuur, dcfWaarde, gedwongenVerkoop, venaleWaarde, venaleWaardePand, parkeerTotaal, oppCheck, controlePunten,
      dcfTransactiekostenPct, dcfTransactiekostenBedrag, dcfWaardeNaTransactiekosten,
      energiecorrectiePct, energiecorrectieBedrag,
      dcfMeerjarenWaarde, dcfJaren, dcfExitYieldPct,
      dcfSamengesteld, voorgesteldeVenaleWaarde,
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
  const isResidentieel = !calc.isGarageStaanplaats && d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed";
  const blokken = [];

  blokken.push({ titel: calc.isGarageStaanplaats ? "Waardering garage/staanplaats" : "Waardering op basis van vervangingswaarde", rijen: [
    ...(calc.isGarageStaanplaats
      ? [
          ["Methode", d.garageWaarderingsMethode],
          ...(calc.garageMethodeM2
            ? [["Prijs per m²", eur(num(d.garagePrijsPerM2))], ["Oppervlakte", `${calc.totOppNaCoeff.toFixed(1)} m²`]]
            : [["Aantal", d.garageAantal], ["Prijs per stuk", eur(num(d.garagePrijsPerStuk))]]),
          ["Waarde garage/staanplaats", eur(calc.garageWaarde)],
        ]
      : !isResidentieel
      ? [["Vervangingswaarde (manueel ingeschat)", calc.gebruiktBedrijfsVervangingswaarde ? eur(calc.actueleWaardeGebouw) : ""]]
      : [
          calc.klasseObj2
            ? ["Klasse", `${d.klasse} (${100 - calc.klasseMixPct}%) / ${d.klasse2} (${calc.klasseMixPct}%)`]
            : ["Klasse", d.klasse],
          // "Gevel" is niet van toepassing bij de nieuwbouwprijzen-tabel (zie berekenWaardering:
          // gevelFactor wordt daar altijd op 1 gezet) — die rij tonen zou een schijnverband suggereren
          // dat niet in de berekening zit.
          ...(calc.isNieuwbouwtabel ? [] : [["Gevel", d.gevel]]),
          [calc.abexPerM2Override !== "" ? "Abex-waarde/m² (manueel overschreven)" : "Abex-waarde/m²", eur(calc.abexPerM2)],
          ["Gemiddelde vetusiteit", pct(calc.gemVetusiteit)],
        ]),
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

  // Samenstelling van de venale waarde zodra er effectief DCF-gegevens meetellen (zie
  // dcfSamengesteld in berekenWaardering) — toont de opbouw van de VOORGESTELDE venale waarde,
  // zodat de rekenwijze in het rapport zelf traceerbaar blijft. Verschijnt niet wanneer er geen
  // DCF-gegevens zijn ingevuld (dan blijft de venale waarde exact de intrinsieke waarde +
  // energiecorrectie, zoals de blokken hierboven al tonen).
  if (calc.dcfSamengesteld > 0) {
    blokken.push({ titel: "Samenstelling venale waarde (incl. DCF)", rijen: [
      ["Intrinsieke waarde" + (calc.energiecorrectieBedrag ? " + energiecorrectie" : ""), eur(calc.intrinsiek + calc.energiecorrectieBedrag)],
      ["Samengestelde DCF-waarde", eur(calc.dcfSamengesteld)],
      ["Voorgestelde venale waarde (gemiddelde)", eur(calc.voorgesteldeVenaleWaarde)],
      ...(d.venaleWaarde !== "" ? [["Venale waarde (manueel overschreven)", eur(calc.venaleWaarde)]] : []),
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
// "calc" is optioneel (tweede parameter) enkel om deze functie ook bruikbaar te houden op plekken
// zonder berekening bij de hand — maar beide huidige aanroepen (bouwers.js/StepRapport.jsx) geven
// calc wel mee, zodat de zin transparant maakt wanneer de DCF meetelde in de voorgestelde venale
// waarde (zie dcfSamengesteld/voorgesteldeVenaleWaarde in berekenWaardering). Bij een manueel
// overschreven venale waarde (d.venaleWaarde !== "") geldt sowieso enkel de ingevulde waarde, dus
// blijft de toelichting achterwege.
export function rapportVenaleWaardeZin(d, calc) {
  const basiszin = `${d.referentiedatum ? `Referentiedatum: ${nlDate(d.referentiedatum)} — ` : ""}De geschatte waarde is de normale venale waarde, zijnde de prijs die vermoedelijk kan worden bekomen bij een normale verkoop onder normale omstandigheden.`;
  if (calc && calc.dcfSamengesteld > 0 && d.venaleWaarde === "") {
    return `${basiszin} Deze werd bepaald als het gemiddelde van de intrinsieke waarde en de rendements-/DCF-benadering.`;
  }
  return basiszin;
}
