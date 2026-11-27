// Tests voor de kwaliteitsscore van een verslag (domein/kwaliteit.js) en waar ze getoond wordt.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { berekenKwaliteit, niveauVoorScore, TABBLADEN } from "../domein/kwaliteit.js";
import { berekenWaardering } from "../domein/waardering.js";
import { initialData } from "../constants.js";
import { valideerDossier } from "../App.jsx";

const foto = (i) => ({ id: `f${i}`, naam: `foto${i}.jpg` });
// een volledig, coherent dossier
const volledig = (o = {}) => ({
  ...initialData, extraPanden: [], parkeerplaatsenGarages: [], reden: "Verkoop", status: "afgewerkt",
  opdrachtgeverNaam: "Eva Braem", datumBezoek: "2026-10-01", datumVerslag: "2026-10-12", referentiedatum: "2026-10-01",
  schatterNaam: "Thijs Houpels", schatterBivNummer: "516660", handtekening: "data:image/png;base64,x", eedPlaats: "Beveren",
  eigenaars: [{ id: 1, naam: "Jan Peeters", recht: "Volle eigendom", aandeel: "100%" }],
  straat: "Kerkstraat", nummer: "4", postcode: "9120", gemeente: "Beveren", capakey: "46021A0123/00B000",
  kadAfdeling: "1", kadSectie: "A", kadPerceelnummer: "123B", ki: "1250",
  bouwtype: "Open", gevel: "4-gevel", bouwjaar: "1985", staat: ["Goed onderhouden"],
  bouwprijsBasis: "Exclusief btw en erelonen",
  // verkoop van een gebouw van vóór 2001: asbest- en bodemattest horen erbij (zie controles.js)
  asbestattest: "Aanwezig — asbestveilig", bodemattest: "Aanwezig — geen verontreiniging gekend",
  omgevingsvoorzieningen: "School en winkels op 500 m", bereikbaarheid: "Vlot via de N70",
  voorgevel: "Gevelsteen", verwarmingSoort: ["Centrale verwarming"], epcStatus: "Aanwezig", epcLabel: "C", epcWaarde: "250",
  sterktes: "Ruime tuin", zwaktes: "Verouderde keuken", kansen: "Uitbreiding", bedreigingen: "Drukke weg", conclusie: "Courant pand",
  wijzeVanWaardering: "Analytische methode", wijzeVanWaarderingMotivering: "Weinig recente verkopen in de straat",
  ruimtes: [{ verdieping: "gelijkvloers", opp: "150", coeff: "1" }, { verdieping: "1everdiep", opp: "93", coeff: "1" }],
  schijven: [{ naam: "Bouwgrond", opp: "800", prijs: "250" }, { naam: "Tuin", opp: "521", prijs: "60" }], grondopp: "1321",
  voorpaginaFoto: { id: "vp" }, fotos: [1, 2, 3, 4, 5, 6].map(foto), documenten: [{ id: "doc", naam: "legger.pdf", omschrijving: "Kadastrale legger" }],
  ...o,
});
const score = (d) => berekenKwaliteit(d, berekenWaardering(d), { blokkerend: valideerDossier(d, berekenWaardering(d)).blokkerend });
const alleTeksten = (k) => k.groepen.flatMap((g) => g.ontbreekt.map((o) => o.tekst)).join(" | ");

describe("kwaliteitsscore", () => {
  it("geeft 100% voor een volledig en coherent dossier", () => {
    const k = score(volledig());
    expect(alleTeksten(k)).toBe("");
    expect(k.score).toBe(100);
    expect(k.niveau.label).toBe("Zeer volledig");
    expect(k.aantalOntbrekend).toBe(0);
  });

  it("verlaagt de score en zegt wat er ontbreekt, met het tabblad", () => {
    const k = score(volledig({ capakey: "", conclusie: "", fotos: [foto(1), foto(2), foto(3)] }));
    expect(k.score).toBeLessThan(100);
    expect(k.score).toBeGreaterThan(75);
    const pand = k.groepen.find((g) => g.naam === "Pand & kadaster");
    expect(pand.ontbreekt.map((o) => [o.tekst, o.tab])).toEqual([["CaPaKey (kadastrale identificatie)", "type"]]);
    expect(alleTeksten(k)).toContain("Foto's in bijlage: 3 van minstens 6");
    expect(alleTeksten(k)).toContain("Conclusie");
  });

  it("geeft deelpunten (bv. de helft van de foto's levert de helft van die punten op)", () => {
    const zonder = score(volledig({ fotos: [] })).score;
    const half = score(volledig({ fotos: [1, 2, 3].map(foto) })).score;
    expect(half).toBeGreaterThan(zonder);
    expect(half).toBeLessThan(100);
  });

  it("blijft onder 50% zolang het verslag niet aangemaakt mag worden", () => {
    const k = score(volledig({ handtekening: "" }));
    expect(k.geblokkeerd).toBe(true);
    expect(k.score).toBeLessThanOrEqual(49);
    expect(alleTeksten(k)).toContain("Handtekening bij de eedformule");
  });

  it("telt criteria die niet van toepassing zijn niet mee", () => {
    // Vlabel-gegevens enkel bij een nalatenschap
    expect(score(volledig()).groepen.find((g) => g.naam === "Opdracht & partijen").max).toBe(14);
    const n = score(volledig({ reden: "Nalatenschap", schatterVlabelNummer: "123", overledenNaam: "", vlabelDossiernummer: "" }));
    expect(alleTeksten(n)).toContain("Naam overledene, Vlabel-dossiernummer");
    // EPC niet aanwezig: geen EPC-gegevens nodig
    expect(alleTeksten(score(volledig({ epcStatus: "Niet aanwezig", epcLabel: "", epcWaarde: "" })))).toBe("");
    // vergelijkingspunten enkel bij de vergelijkende methode
    const v = score(volledig({ wijzeVanWaardering: "Vergelijkende methode", vergelijkingspunten: [{ id: "a", meetellen: true }] }));
    expect(alleTeksten(v)).toContain("Vergelijkingspunten: 1 van minstens 3");
  });

  it("neemt controlepunten van de berekening en tegenstrijdigheden mee", () => {
    const k = score(volledig({ schijven: [], bouwtype: "Halfopen" }));
    const w = k.groepen.find((g) => g.naam === "Waardering");
    expect(w.ontbreekt.some((o) => /grondwaarde is nog 0/i.test(o.tekst) && o.tab === "afmetingen")).toBe(true);
    const s = k.groepen.find((g) => g.naam === "Samenhang");
    expect(s.ontbreekt.some((o) => /Bouwtype "Halfopen"/.test(o.tekst) && o.tab === "type")).toBe(true);
    expect(k.score).toBeLessThan(100);
  });

  it("een leeg dossier scoort laag", () => {
    const k = score({ ...initialData, extraPanden: [], parkeerplaatsenGarages: [] });
    expect(k.score).toBeLessThan(50);
    expect(k.niveau.label).toBe("Sterk onvolledig");
  });

  it("niveaus", () => {
    expect(niveauVoorScore(95).label).toBe("Zeer volledig");
    expect(niveauVoorScore(80).label).toBe("Volledig");
    expect(niveauVoorScore(60).label).toBe("Onvolledig");
    expect(niveauVoorScore(10).label).toBe("Sterk onvolledig");
  });

  it("verwijst enkel naar tabbladen die bestaan in de wizard", () => {
    const wizard = fs.readFileSync(path.join(process.cwd(), "src/schermen/DossierWizard.jsx"), "utf8");
    // het label mag ook het tweede deel van een keuze zijn (bv. "Perceel & grondwaarde" bij grond)
    for (const [k, label] of Object.entries(TABBLADEN)) {
      expect(wizard.includes(`{ key: "${k}", label: "${label}"`) || new RegExp(`\\{ key: "${k}", label: [^,]*: "${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(wizard)).toBe(true);
    }
  });

  it("staat in de kopbalk van het dossier en op het tabblad Rapport — niet in het verslag", () => {
    const wizard = fs.readFileSync(path.join(process.cwd(), "src/schermen/DossierWizard.jsx"), "utf8");
    expect(wizard).toContain('<KwaliteitsBadge kwaliteit={kwaliteit} onClick={() => gaNaarTab("rapport")} />');
    expect(wizard).toContain("<KwaliteitsPaneel kwaliteit={kwaliteit}");
    expect(fs.readFileSync(path.join(process.cwd(), "src/ui/Kwaliteit.jsx"), "utf8")).toContain('className="no-print');
    for (const f of ["rapport/bouwers.js", "rapport/html.js", "rapport/StepRapport.jsx"]) {
      expect(fs.readFileSync(path.join(process.cwd(), "src", f), "utf8")).not.toMatch(/berekenKwaliteit|Kwaliteits(Paneel|Badge)|domein\/kwaliteit/);
    }
  });
});
