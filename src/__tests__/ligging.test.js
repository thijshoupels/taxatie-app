// Tests voor "Ligging in de omgeving" in het verslag: van lange, aan elkaar geplakte alinea's
// (chips + AI-tekst met komma's) naar een korte opsomming per rubriek — zie domein/ligging.js.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { liggingPunten, liggingRubrieken } from "../domein/ligging.js";
import { OPTS, initialData } from "../constants.js";
import { berekenWaardering } from "../domein/waardering.js";
import { buildReportData } from "../rapport/bouwers.js";

const VOORZ = { chips: OPTS.omgevingsvoorzieningen, chipsSamen: true };
const BEREIK = { chips: OPTS.bereikbaarheid };

describe("liggingPunten — tekst naar korte opsommingspunten", () => {
  it("splitst een oude, met komma's aan elkaar geplakte tekst in gegroepeerde chips + losse zinnen", () => {
    const tekst = "Scholen, Apotheek, Horeca, In de ruimere omgeving bevindt zich supermarkt Colruyt op ca. 1,2 km. Het AZ Nikolaas ligt op 6 km.";
    expect(liggingPunten(tekst, VOORZ)).toEqual([
      "Scholen, apotheek, horeca",
      "In de ruimere omgeving bevindt zich supermarkt Colruyt op ca. 1,2 km",
      "Het AZ Nikolaas ligt op 6 km",
    ]);
  });

  it("geeft elk punt op een eigen regel als apart opsommingspunt terug en haalt opsommingstekens weg", () => {
    expect(liggingPunten("- Bushalte De Lijn (lijn 94) — 250 m\n• Station Sint-Niklaas — ca. 4 km\n\n", BEREIK)).toEqual([
      "Bushalte De Lijn (lijn 94) — 250 m",
      "Station Sint-Niklaas — ca. 4 km",
    ]);
  });

  it("laat een decimale komma en afkortingen (ca., o.a.) heel", () => {
    expect(liggingPunten("Winkels o.a. Delhaize en Aldi op ca. 1,5 km", VOORZ)).toEqual(["Winkels o.a. Delhaize en Aldi op ca. 1,5 km"]);
  });

  it("haalt een chipwoord niet uit het midden van een zin", () => {
    expect(liggingPunten("Scholen en winkels op wandelafstand", VOORZ)).toEqual(["Scholen en winkels op wandelafstand"]);
  });

  it("houdt een chip met een komma erin ('Rustige, verkeersluwe straat') heel", () => {
    expect(liggingPunten("Vlot bereikbaar met de wagen, Rustige, verkeersluwe straat", BEREIK)).toEqual([
      "Vlot bereikbaar met de wagen",
      "Rustige, verkeersluwe straat",
    ]);
  });

  it("zet bereikbaarheid-chips elk als apart punt (niet gegroepeerd)", () => {
    expect(liggingPunten("Nabij openbaar vervoer (bus), Nabij op-/afrit autosnelweg", BEREIK)).toEqual([
      "Nabij openbaar vervoer (bus)",
      "Nabij op-/afrit autosnelweg",
    ]);
  });

  it("verwijdert dubbels en geeft een lege lijst voor een leeg veld", () => {
    expect(liggingPunten("Apotheek, Apotheek\nApotheek", VOORZ)).toEqual(["Apotheek"]);
    expect(liggingPunten("", VOORZ)).toEqual([]);
    expect(liggingPunten(undefined, VOORZ)).toEqual([]);
    expect(liggingPunten("   \n  ", VOORZ)).toEqual([]);
  });
});

describe("liggingRubrieken", () => {
  it("toont enkel ingevulde rubrieken, en de mobiscore als eerste punt bij bereikbaarheid", () => {
    const r = liggingRubrieken({ omgevingsvoorzieningen: "", bereikbaarheid: "Station — 2 km", straatuitrusting: "Voetpad, Riolering", mobiscore: "7.4" });
    expect(r).toEqual([
      ["Bereikbaarheid", ["Mobiscore 7,4/10", "Station — 2 km"]],
      ["Toestand & uitrusting straat", ["Voetpad, riolering"]],
    ]);
  });

  it("laat een algemene bereikbaarheid-chip weg als een concreet punt hetzelfde preciezer zegt", () => {
    const r = liggingRubrieken({
      bereikbaarheid: "Nabij openbaar vervoer (bus), Nabij openbaar vervoer (trein), Beperkte parkeermogelijkheden\nBushalte De Lijn (lijn 94) — 250 m\nOp-/afrit E17 (nr. 14) — 3 km",
    });
    expect(r).toEqual([
      ["Bereikbaarheid", ["Nabij openbaar vervoer (trein)", "Beperkte parkeermogelijkheden", "Bushalte De Lijn (lijn 94) — 250 m", "Op-/afrit E17 (nr. 14) — 3 km"]],
    ]);
  });

  it("geeft een lege lijst wanneer niets ingevuld is", () => {
    expect(liggingRubrieken({ omgevingsvoorzieningen: "", bereikbaarheid: "", straatuitrusting: "", mobiscore: "" })).toEqual([]);
  });
});

describe("verslag — sectie 'Ligging, omgeving & terrein'", () => {
  const basis = (extra) => ({ ...initialData, id: "d1", ruimtes: [{ opp: "150", coeff: "1" }], extraPanden: [], parkeerplaatsenGarages: [], ...extra });
  const sectie = (html, titel) => html.split(titel)[1].split('<section class="rsec">')[0];

  it("toont de omgeving als opsomming (lijstjes) i.p.v. lopende alinea's", () => {
    const d = basis({
      omgevingsvoorzieningen: "Scholen, Apotheek\nSupermarkt Colruyt — ca. 1,2 km",
      bereikbaarheid: "Bushalte (lijn 94) — 250 m",
      straatuitrusting: "Voetpad, Riolering, Aardgas",
      mobiscore: "7.4",
    });
    const html = buildReportData(d, berekenWaardering(d), undefined).sectionsBlockHtml;
    const ligging = sectie(html, "Ligging, omgeving &amp; terrein");
    expect(ligging).toContain("Ligging in de omgeving");
    expect(ligging).toContain("<li style=\"margin:0 0 3px 0;\">Scholen, apotheek</li>");
    expect(ligging).toContain("Supermarkt Colruyt — ca. 1,2 km</li>");
    expect(ligging).toContain("Mobiscore 7,4/10</li>");
    expect(ligging).toContain("Voetpad, riolering, aardgas</li>");
    // de vroegere lopende-tekst-labels ("Voorzieningen: ...") zijn weg
    expect(ligging).not.toContain("<strong>Voorzieningen: </strong>");
  });

  it("zet de stedenbouwkundige voorschriften bij de stedenbouwkundige gegevens en de mobiscore bij de ligging", () => {
    const d = basis({ bpaRupVerkaveling: "RUP Centrum Beveren", mobiscore: "6" });
    const html = buildReportData(d, berekenWaardering(d), undefined).sectionsBlockHtml;
    const ligging = sectie(html, "Ligging, omgeving &amp; terrein");
    const markt = sectie(html, "Markt &amp; stedenbouwkundige gegevens");
    expect(ligging).not.toContain("RUP Centrum Beveren");
    expect(markt).toContain("RUP Centrum Beveren");
    expect(ligging).toContain("Mobiscore 6/10");
    expect(markt).not.toContain("Mobiscore");
  });

  it("laat de hele omgevingsrubriek weg wanneer er niets ingevuld is", () => {
    const d = basis({ omgevingsvoorzieningen: "", bereikbaarheid: "", straatuitrusting: "", mobiscore: "" });
    const html = buildReportData(d, berekenWaardering(d), undefined).sectionsBlockHtml;
    expect(sectie(html, "Ligging, omgeving &amp; terrein")).not.toContain("Ligging in de omgeving");
  });
});
