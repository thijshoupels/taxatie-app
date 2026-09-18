// Tests voor de AI-voorstellen-witlijst (bouwAiVoorstellen) en de verslag-validatie
// (valideerDossier) uit App.jsx — twee zuivere, veiligheidskritieke functies die voordien
// volledig ongetest waren. bouwAiVoorstellen bepaalt wat een AI-documentanalyse mag doorzetten
// naar een dossier (zie App.jsx, "AI-VOORSTELLEN — witte lijst + controle"); valideerDossier
// bepaalt of een verslag mag afgeleverd worden. Een stille regressie in een van beide zou hier
// niet in de UI opvallen, maar wel in een verslag dat onder eed vertrekt.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { bouwAiVoorstellen, valideerDossier } from "../App.jsx";
import { buildPropertySummary } from "../data/ai.js";
import { maakLeegPand, initialData } from "../constants.js";

describe("bouwAiVoorstellen — tekstvelden", () => {
  it("stelt een tekstveld voor wanneer de waarde afwijkt van de huidige", () => {
    const { voorstellen, geweigerd } = bouwAiVoorstellen({ straat: "Kerkstraat" }, { straat: "Oude straat" });
    expect(geweigerd).toEqual([]);
    expect(voorstellen).toEqual([{ veld: "straat", label: "Straat", oud: "Oude straat", nieuw: "Kerkstraat" }]);
  });

  it("stelt niets voor wanneer de waarde gelijk blijft aan de huidige", () => {
    const { voorstellen, geweigerd } = bouwAiVoorstellen({ straat: "Kerkstraat" }, { straat: "Kerkstraat" });
    expect(voorstellen).toEqual([]);
    expect(geweigerd).toEqual([]);
  });

  it("slaat lege, null- of undefined-waarden stilzwijgend over (geen voorstel, geen weigering)", () => {
    const { voorstellen, geweigerd } = bouwAiVoorstellen({ straat: "", postcode: null, gemeente: undefined }, {});
    expect(voorstellen).toEqual([]);
    expect(geweigerd).toEqual([]);
  });

  it("weigert een tekstwaarde die onwaarschijnlijk lang is (boven het max voor dat veld)", () => {
    const { geweigerd } = bouwAiVoorstellen({ capakey: "x".repeat(41) }, {}); // max: 40
    expect(geweigerd).toEqual([{ veld: "capakey", reden: "waarde is onwaarschijnlijk lang" }]);
  });
});

describe("bouwAiVoorstellen — witte lijst", () => {
  it("weigert een veld dat niet in de witte lijst staat (bv. een gehallucineerde sleutel)", () => {
    const { voorstellen, geweigerd } = bouwAiVoorstellen({ nietBestaandVeld: "iets" }, {});
    expect(voorstellen).toEqual([]);
    expect(geweigerd).toEqual([{ veld: "nietBestaandVeld", reden: "wordt niet automatisch ingevuld" }]);
  });
});

describe("bouwAiVoorstellen — keuzevelden", () => {
  it("matcht case-insensitief en normaliseert naar de exacte schrijfwijze uit de keuzelijst", () => {
    const { voorstellen } = bouwAiVoorstellen({ erfgoed: "ja" }, { erfgoed: "" });
    expect(voorstellen).toEqual([{ veld: "erfgoed", label: "Onroerend erfgoed", oud: "", nieuw: "Ja" }]);
  });

  it("weigert een waarde die niet in de keuzelijst voorkomt", () => {
    const { geweigerd } = bouwAiVoorstellen({ erfgoed: "Misschien" }, {});
    expect(geweigerd).toEqual([{ veld: "erfgoed", reden: '"Misschien" staat niet in de keuzelijst' }]);
  });
});

describe("bouwAiVoorstellen — getalvelden", () => {
  it("zet een komma om naar een punt en aanvaardt de waarde binnen het toegelaten bereik", () => {
    const { voorstellen } = bouwAiVoorstellen({ mobiscore: "7,5" }, {}); // min 0, max 10
    expect(voorstellen).toEqual([{ veld: "mobiscore", label: "Mobiscore", oud: "", nieuw: "7.5" }]);
  });

  it("weigert een getal buiten het toegelaten bereik", () => {
    const { geweigerd } = bouwAiVoorstellen({ mobiscore: "15" }, {});
    expect(geweigerd).toEqual([{ veld: "mobiscore", reden: '"15" is geen geldig getal tussen 0 en 10' }]);
  });

  it("weigert een niet-numerieke waarde", () => {
    const { geweigerd } = bouwAiVoorstellen({ mobiscore: "onbekend" }, {});
    expect(geweigerd).toHaveLength(1);
    expect(geweigerd[0].veld).toBe("mobiscore");
  });
});

describe("valideerDossier — blokkerende punten", () => {
  it("meldt alle basisvelden als blokkerend wanneer het dossier volledig leeg is", () => {
    const { blokkerend } = valideerDossier({});
    expect(blokkerend).toHaveLength(5); // adres, datum verslag, referentiedatum, schatternaam, handtekening
  });

  it("geeft geen enkel blokkerend punt terug bij een volledig ingevuld, niet-Nalatenschap dossier", () => {
    const { blokkerend } = valideerDossier({
      straat: "Kerkstraat 1", gemeente: "Sint-Niklaas", datumVerslag: "2026-09-14",
      referentiedatum: "2026-09-14", schatterNaam: "Thijs Houpels", handtekening: "data:image/png;...",
      status: "afgewerkt", fotos: [{}],
    });
    expect(blokkerend).toEqual([]);
  });

  it("gebruikt bij een Nalatenschap de overlijdens-specifieke boodschap voor de referentiedatum", () => {
    const { blokkerend } = valideerDossier({
      reden: "Nalatenschap", straat: "x", gemeente: "y", datumVerslag: "d", schatterNaam: "z", handtekening: "h",
    });
    expect(blokkerend).toContain("Datum overlijden (referentiedatum) — bepaalt de waarde bij een nalatenschap");
  });

  it("vereist bij een Nalatenschap ook het Vlabel-identificatienummer van de schatter", () => {
    const { blokkerend } = valideerDossier({
      reden: "Nalatenschap", straat: "x", gemeente: "y", datumVerslag: "d", referentiedatum: "d",
      schatterNaam: "z", handtekening: "h", schatterVlabelNummer: "",
    });
    expect(blokkerend.some((b) => b.includes("Vlabel-identificatienummer"))).toBe(true);
  });
});

describe("valideerDossier — aandachtspunten", () => {
  const basis = {
    straat: "x", gemeente: "y", datumVerslag: "d", referentiedatum: "d", schatterNaam: "z", handtekening: "h",
  };

  it("waarschuwt dat een concept-dossier het ONTWERP-watermerk krijgt", () => {
    const { aandachtspunten } = valideerDossier({ ...basis, status: "concept" });
    expect(aandachtspunten.some((a) => a.includes("ONTWERP"))).toBe(true);
  });

  it("geeft geen ONTWERP-aandachtspunt meer zodra het dossier afgewerkt is", () => {
    const { aandachtspunten } = valideerDossier({ ...basis, status: "afgewerkt", fotos: [{}] });
    expect(aandachtspunten.some((a) => a.includes("ONTWERP"))).toBe(false);
  });

  it("waarschuwt wanneer de vergelijkende methode gekozen is zonder vergelijkingspunten", () => {
    const { aandachtspunten } = valideerDossier({
      ...basis, status: "afgewerkt", fotos: [{}], wijzeVanWaardering: "Vergelijkende methode", vergelijkingspunten: [],
    });
    expect(aandachtspunten.some((a) => a.includes("vergelijkende methode"))).toBe(true);
  });

  it("waarschuwt wanneer er nog geen foto's zijn toegevoegd", () => {
    const { aandachtspunten } = valideerDossier({ ...basis, status: "afgewerkt", fotos: [] });
    expect(aandachtspunten.some((a) => a.includes("foto's"))).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// buildPropertySummary — de samenvatting die als context naar de AI gaat
// ----------------------------------------------------------------------------
// Deze functie draait niet enkel voor het hoofddossier, maar ook voor elk EXTRA pand: het tabblad
// SWOT krijgt bij een pand het pand-object mee (zie DossierWizard/bindPand). Een pand houdt een
// deel van de dossiergegevens niet zelf bij — de eigenaarslijst staat bijvoorbeeld één keer op het
// dossier. Werd daar niet op gerekend, dan liep de AI-aanvraag bij een extra pand vast met "Cannot
// read properties of undefined (reading 'filter')" en viel de app terug op het lokale voorstel.
describe("buildPropertySummary — ook bruikbaar voor een extra pand", () => {
  it("loopt niet vast op een pand zonder eigen eigenaarslijst", () => {
    const pand = { ...maakLeegPand("Pand 2"), id: "dossier-1" };
    let samenvatting = null;
    let fout = null;
    try { samenvatting = buildPropertySummary(pand); } catch (e) { fout = e; }
    expect(fout).toBeNull();
    expect(samenvatting).toContain("Eigendomstoestand: onbekend");
  });

  it("toont de eigenaars wel gewoon voor het hoofddossier", () => {
    const dossier = {
      ...initialData,
      eigenaars: [{ naam: "Jan Janssens", recht: "Volle eigendom", aandeel: "1/1" }],
    };
    expect(buildPropertySummary(dossier)).toContain("Jan Janssens");
  });
});
