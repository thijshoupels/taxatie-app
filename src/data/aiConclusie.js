// ----------------------------------------------------------------------------
// data/aiConclusie.js — AI-voorstel voor de conclusie van het verslag
// ----------------------------------------------------------------------------
// Een knop op het tabblad SWOT-analyse ("Conclusie & notities") vraagt Claude een voorstel voor
// de conclusie, op basis van wat in het dossier staat: de beschrijving van het pand, de SWOT en de
// uitkomst van de waardering. De schatter-expert ziet het voorstel eerst en kiest zelf of hij het
// overneemt — er wordt nooit iets stil overschreven.
//
// Enkel voor de platform-beheerder (magAiConclusie): die vlag staat in de databank
// (profielen.is_platform_beheerder) en kan een gebruiker niet zelf aanzetten.
//
// Wat NIET meegaat naar de AI (gegevensminimalisatie):
//   - namen: opdrachtgever, eigenaars, overledene, huurder, schatter — de conclusie heeft ze niet nodig;
//   - de kernpunten uit de documenten (daar staan vaak namen in uit aktes en attesten);
//   - straat en huisnummer: enkel postcode en gemeente;
//   - vergelijkingspunten (adressen, prijzen) — en dus ook nooit gegevens uit Vlabel, die enkel
//     binnen het eigen dossier gebruikt mogen worden.
import { buildPropertySummary, callClaudeTekst } from "./ai.js";
import { eur } from "../lib/format.js";

export const magAiConclusie = (user) => !!(user && user.isPlatformBeheerder);

const getal = (v) => String(Math.round(v * 10) / 10).replace(".", ",");
const lijst = (t) => String(t || "").split("\n").map((l) => l.trim()).filter(Boolean);

export function bouwConclusieContext(d, calc) {
  // de pandsamenvatting van het SWOT-voorstel, zonder eigenaarsnamen en zonder straat/huisnummer
  // (de kernpunten uit documenten blijven weg: daar staan vaak namen in uit aktes en attesten)
  const samenvatting = buildPropertySummary(d).split("\nJuridische / administratieve documenten (kernpunten):")[0];
  const pand = samenvatting.split("\n")
    .filter((l) => !/^Eigendomstoestand:/.test(l) && !/^Aantal vergelijkingspunten:/.test(l))
    .map((l) => (/^Adres:/.test(l) ? `Ligging: ${[d.postcode, d.gemeente].filter(Boolean).join(" ") || "onbekend"}` : l));
  const regels = [`Doel van de schatting: ${d.reden || "onbekend"}`, ...pand];

  const swot = [["Sterktes", d.sterktes], ["Zwaktes", d.zwaktes], ["Kansen", d.kansen], ["Bedreigingen", d.bedreigingen]]
    .filter(([, t]) => lijst(t).length);
  if (swot.length) {
    regels.push("SWOT-analyse:");
    for (const [k, t] of swot) regels.push(`${k}: ${lijst(t).join("; ")}`);
  }

  if (calc) {
    regels.push("Waardering:");
    if (calc.totOppNaCoeff > 0) regels.push(`Berekende oppervlakte (na coëfficiënten): ${getal(calc.totOppNaCoeff)} m²`);
    if (calc.intrinsiek > 0) regels.push(`Intrinsieke waarde: ${eur(calc.intrinsiek)}`);
    if (calc.dcfWaarde > 0) regels.push(`Rendementswaarde (DCF): ${eur(calc.dcfWaarde)}`);
    if (calc.venaleWaarde > 0) regels.push(`Venale waarde (eindconclusie van de schatter-expert): ${eur(calc.venaleWaarde)}`);
    const pv = calc.prijsvork;
    if (pv && pv.beschikbaar) regels.push(`Prijsvork: ${eur(pv.minimum)} – ${eur(pv.maximum)}`);
    if (calc.toonGedwongenVerkoop && calc.gedwongenVerkoop > 0) regels.push(`Gedwongen verkoopwaarde: ${eur(calc.gedwongenVerkoop)}`);
  }
  return regels.join("\n");
}

export function bouwConclusiePrompt(d, calc) {
  return `Je bent een Vlaamse vastgoedschatter-expert. Schrijf de CONCLUSIE van een taxatieverslag op basis van onderstaande dossiergegevens.

Regels:
- Nederlands (Vlaanderen), zakelijk en feitelijk, in de stijl van een professioneel taxatieverslag. Geen overdrijvingen of verkooptaal.
- Eén of twee alinea's, samen hoogstens 150 woorden. Gewone tekst: geen titels, opsommingstekens of markdown.
- Vat samen wat het pand is, de belangrijkste sterktes en aandachtspunten die de waarde bepalen, en sluit af met de venale waarde (en de prijsvork als die gegeven is), exact zoals hieronder vermeld.
- Gebruik enkel gegevens die hieronder staan. Verzin niets: geen cijfers, gebreken, renovaties of ligging die niet vermeld zijn. Is een gegeven onbekend, laat het dan weg.
- Noem geen namen van personen en verwijs niet naar AI.

Dossiergegevens:
${bouwConclusieContext(d, calc)}

Antwoord enkel met de tekst van de conclusie.`;
}

export async function genereerAiConclusie(d, calc) {
  const tekst = await callClaudeTekst(bouwConclusiePrompt(d, calc));
  const schoon = tekst.replace(/^\s*(conclusie)\s*:?\s*\n+/i, "").replace(/\*\*/g, "").trim();
  if (!schoon) throw new Error("De AI gaf een leeg antwoord.");
  return schoon;
}

// ---- AI-voorstel voor de motivering van de waarderingsmethode ----
// Enkel zinvol als NIET de vergelijkende methode gekozen is: het veld "Motivering van de
// afwijking" (tabblad Vergelijkingspunten) staat er dan. Dezelfde gegevensminimalisatie als
// hierboven; van de vergelijkingspunten gaat enkel het AANTAL mee.
export function bouwMotiveringPrompt(d, calc) {
  const aantalVgl = (d.vergelijkingspunten || []).filter((v) => v && v.meetellen !== false).length;
  return `Je bent een Vlaamse vastgoedschatter-expert. Schrijf voor een taxatieverslag de MOTIVERING waarom voor dit pand de "${d.wijzeVanWaardering}" gebruikt werd in plaats van de vergelijkende methode (die in Vlaanderen de regel is).

Regels:
- Nederlands (Vlaanderen), zakelijk, 2 tot 4 zinnen, samen hoogstens 90 woorden. Gewone tekst, geen opsomming of markdown.
- Steun enkel op de gegevens hieronder (bv. het aantal bruikbare vergelijkingspunten, het type pand, een groot of atypisch perceel, de ligging). Verzin geen marktgegevens, verkopen of cijfers.
- Is er onvoldoende houvast in de gegevens, schrijf dan een algemene, voorzichtige motivering die de schatter-expert zelf kan aanvullen.
- Noem geen namen van personen en verwijs niet naar AI.

Gekozen methode: ${d.wijzeVanWaardering}
Aantal vergelijkingspunten in het dossier: ${aantalVgl}
${bouwConclusieContext(d, calc)}

Antwoord enkel met de tekst van de motivering.`;
}

export async function genereerAiMotivering(d, calc) {
  const tekst = await callClaudeTekst(bouwMotiveringPrompt(d, calc), "claude-sonnet-4-6", 600);
  const schoon = tekst.replace(/^\s*(motivering)\s*:?\s*\n+/i, "").replace(/\*\*/g, "").trim();
  if (!schoon) throw new Error("De AI gaf een leeg antwoord.");
  return schoon;
}

