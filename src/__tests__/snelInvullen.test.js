// Tests voor "sneller invullen zonder kwaliteitsverlies": persoonlijke standaarden, gevels die de
// voorgevel volgen, datum verslag bij afwerken, meer velden uit de AI-documentanalyse (kadastrale
// legger en EPC-attest), en het AI-voorstel voor de motivering van de waarderingsmethode.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { STANDAARD_VELDEN, controleerStandaard, schoonStandaarden, pasStandaardenToe } from "../domein/standaarden.js";
import { naStatusWissel, vandaagIso } from "../domein/status.js";
import { volgVoorgevel } from "../stappen/StepConstructie.jsx";
import { bouwAiVoorstellen, leesGeheelGetal, leesDatum } from "../App.jsx";
import { JURIDISCHE_AI_VELDEN, splitsDocumentAnalyse, epcVeldenVoorType } from "../data/ai.js";
import { bouwMotiveringPrompt } from "../data/aiConclusie.js";
import { berekenKwaliteit } from "../domein/kwaliteit.js";
import { berekenWaardering } from "../domein/waardering.js";
import { initialData } from "../constants.js";

const lees = (f) => fs.readFileSync(path.join(process.cwd(), f), "utf8");

describe("persoonlijke standaarden", () => {
  it("controleert elke waarde", () => {
    expect(controleerStandaard("gedwongenFactor", "0,80")).toBe("0.80");
    expect(controleerStandaard("gedwongenFactor", "1,5")).toBe(undefined); // buiten 0,5 - 1
    expect(controleerStandaard("yieldVan", "2,5")).toBe("2.5");
    expect(controleerStandaard("dcfTransactiekostenActief", true)).toBe(true);
    expect(controleerStandaard("dcfTransactiekostenActief", "ja")).toBe(undefined);
    expect(controleerStandaard("wijzeVanWaardering", "Analytische methode")).toBe("Analytische methode");
    expect(controleerStandaard("wijzeVanWaardering", "Gok")).toBe(undefined);
    expect(controleerStandaard("hoofddakMateriaal", "Leien")).toBe("Leien");
    expect(controleerStandaard("eedPlaats", "  Temse ")).toBe("Temse");
    expect(controleerStandaard("venaleWaarde", "500000")).toBe(undefined); // geen standaard mogelijk
    expect(controleerStandaard("yieldVan", "")).toBe(undefined);
  });

  it("past ze toe op een nieuw dossier; zij- en achtergevel volgen de voorgevel", () => {
    const d = pasStandaardenToe(initialData, {
      gedwongenFactor: "0,80", yieldVan: "2,5", yieldTot: "3,5", dcfTransactiekostenActief: true, dcfTransactiekostenPct: "14",
      wijzeVanWaardering: "Analytische methode", voorgevel: "Gevelsteen (baksteen)", bijgebouwConstructie: "Beton",
      venaleWaarde: "999999", ruimtes: [], // onbekend: genegeerd
    });
    expect(d.gedwongenFactor).toBe("0.80");
    expect([d.yieldVan, d.yieldTot]).toEqual(["2.5", "3.5"]);
    expect(d.dcfTransactiekostenActief).toBe(true);
    expect(d.dcfTransactiekostenPct).toBe("14");
    expect(d.wijzeVanWaardering).toBe("Analytische methode");
    expect([d.voorgevel, d.zijgevel, d.achtergevel]).toEqual(["Gevelsteen (baksteen)", "Gevelsteen (baksteen)", "Gevelsteen (baksteen)"]);
    expect(d.venaleWaarde).toBe(initialData.venaleWaarde);
    expect(d.ruimtes).toBe(initialData.ruimtes);
    // de standaarden werken: de berekening gebruikt ze
    const calc = berekenWaardering({ ...d, extraPanden: [], parkeerplaatsenGarages: [], huurMaand: "1000" });
    expect(calc.yieldRows.map((r) => r.yield)).toEqual([2.5, 3, 3.5]);
  });

  it("zonder standaarden verandert er niets", () => {
    expect(pasStandaardenToe(initialData, undefined)).toEqual({ ...initialData });
    expect(schoonStandaarden(null)).toEqual({});
    expect(schoonStandaarden("rommel")).toEqual({});
  });

  it("elk standaardveld bestaat in een nieuw dossier", () => {
    for (const v of STANDAARD_VELDEN) expect(v.k in initialData).toBe(true);
  });

  it("een nieuw dossier start met de standaarden, en daarna de schatter-gegevens", () => {
    const app = lees("src/App.jsx");
    expect(app).toContain("...pasStandaardenToe(initialData, session.voorkeuren && session.voorkeuren.standaarden),");
    expect(app).toContain("haalVoorkeuren(user.id)");
  });
});

describe("gevels volgen de voorgevel", () => {
  it("zolang ze leeg of nog gelijk aan de voorgevel zijn", () => {
    expect(volgVoorgevel({ voorgevel: "", zijgevel: "", achtergevel: "" }, "Gevelsteen (baksteen)"))
      .toEqual([["voorgevel", "Gevelsteen (baksteen)"], ["zijgevel", "Gevelsteen (baksteen)"], ["achtergevel", "Gevelsteen (baksteen)"]]);
    expect(volgVoorgevel({ voorgevel: "Gepleisterd", zijgevel: "Gepleisterd", achtergevel: "Houten gevelbekleding" }, "Natuursteen"))
      .toEqual([["voorgevel", "Natuursteen"], ["zijgevel", "Natuursteen"]]);
  });
  it("de voorgevel in het tabblad gebruikt dit", () => {
    const c = lees("src/stappen/StepConstructie.jsx");
    expect(c).toContain('onChange={(e) => zetVoorgevel(e.target.value)}');
    expect(c).toContain("onPick={(v) => zetVoorgevel(v)}");
  });
});

describe("datum van het verslag bij afwerken", () => {
  const nu = new Date(2026, 10, 23, 0, 30); // 23/11/2026 00:30 lokale tijd
  it("vult een lege datum met vandaag (lokale datum)", () => {
    expect(vandaagIso(nu)).toBe("2026-11-23");
    expect(naStatusWissel({ status: "concept", datumVerslag: "" }, nu)).toEqual({ status: "afgewerkt", datumVerslag: "2026-11-23" });
  });
  it("laat een ingevulde datum staan, en terug naar concept verandert niets", () => {
    expect(naStatusWissel({ status: "concept", datumVerslag: "2026-11-02" }, nu)).toEqual({ status: "afgewerkt", datumVerslag: "2026-11-02" });
    expect(naStatusWissel({ status: "afgewerkt", datumVerslag: "" }, nu)).toEqual({ status: "concept", datumVerslag: "" });
  });
  it("de statusknop gebruikt dit", () => {
    expect(lees("src/schermen/DossierWizard.jsx")).toContain("onClick={() => setD((p) => naStatusWissel(p))}");
  });
});

describe("AI-documentanalyse: kadastrale legger en EPC-attest", () => {
  it("vraagt de nieuwe velden en zet ze door naar het voorstellenpaneel", () => {
    for (const k of ["ki", "kadastraleOpp", "bouwjaar", "epcStatus", "epcLabel", "epcWaarde", "epcCertificaatnummer", "epcDatum"]) {
      expect(JURIDISCHE_AI_VELDEN).toContain(k);
    }
    const prompt = lees("src/stappen/StepDocumenten.jsx");
    expect(prompt).toContain('"ki":"","kadastraleOpp":"","bouwjaar":"","epcStatus":"","epcLabel":"","epcWaarde":"","epcCertificaatnummer":"","epcDatum":""');
    expect(splitsDocumentAnalyse({ ki: "1250", epcLabel: "C" }).juridisch).toMatchObject({ ki: "1250", epcLabel: "C" });
  });

  it("controleert en zet de waarden om", () => {
    const { voorstellen, geweigerd } = bouwAiVoorstellen({
      ki: "1.250", kadastraleOpp: "530", bouwjaar: "1975", epcLabel: "c", epcWaarde: "245,5",
      epcCertificaatnummer: "20230517-0002812345-RES-1", epcDatum: "17/05/2023", epcStatus: "Aanwezig",
    }, { ...initialData, epcStatus: "Niet aanwezig" });
    const v = Object.fromEntries(voorstellen.map((x) => [x.veld, x.nieuw]));
    expect(v).toEqual({
      ki: "1250", kadastraleOpp: "530", bouwjaar: "1975", epcLabel: "C", epcWaarde: "245.5",
      epcCertificaatnummer: "20230517-0002812345-RES-1", epcDatum: "2023-05-17", epcStatus: "Aanwezig",
    });
    expect(geweigerd).toEqual([]);
  });

  it("weigert onzin", () => {
    const { voorstellen, geweigerd } = bouwAiVoorstellen({ epcLabel: "Z", bouwjaar: "3025", epcDatum: "31/02/2023", ki: "veel" }, initialData);
    expect(voorstellen).toEqual([]);
    expect(geweigerd.map((g) => g.veld).sort()).toEqual(["bouwjaar", "epcDatum", "epcLabel", "ki"]);
  });

  it("leest getallen en datums zoals ze op een attest staan", () => {
    expect(leesGeheelGetal("1 250 €")).toBe(1250);
    expect(leesGeheelGetal("12.500")).toBe(12500);
    expect(leesGeheelGetal("1250,40")).toBe(1250);
    expect(leesDatum("2023-05-17")).toBe("2023-05-17");
    expect(leesDatum("7-3-2021")).toBe("2021-03-07");
    expect(leesDatum("2023-13-01")).toBe("");
    expect(leesDatum("1999-01-01")).toBe(""); // vóór het EPC bestond
  });

  it("bij bedrijfsvastgoed gaan de EPC-gegevens naar de bedrijfsEpc-velden", () => {
    const uit = epcVeldenVoorType({ capakey: "x", epcStatus: "Aanwezig", epcLabel: "B", epcWaarde: "300", epcCertificaatnummer: "N1", epcDatum: "2024-01-02" }, true);
    expect(uit).toEqual({ capakey: "x", bedrijfsEpcLabel: "B", bedrijfsEpcWaarde: "300", bedrijfsEpcCertificaatnummer: "N1", bedrijfsEpcDatum: "2024-01-02" });
    expect(epcVeldenVoorType({ epcLabel: "B" }, false)).toEqual({ epcLabel: "B" });
    const { voorstellen } = bouwAiVoorstellen(uit, { ...initialData, vastgoedType: "Kantoor" });
    expect(voorstellen.map((v) => v.veld).sort()).toEqual(["bedrijfsEpcCertificaatnummer", "bedrijfsEpcDatum", "bedrijfsEpcLabel", "bedrijfsEpcWaarde", "capakey"]);
  });
});

describe("AI-voorstel voor de motivering van de waarderingsmethode", () => {
  const d = {
    ...initialData, extraPanden: [], parkeerplaatsenGarages: [], wijzeVanWaardering: "Analytische methode",
    straat: "Kerkstraat", nummer: "4", postcode: "9120", gemeente: "Beveren", opdrachtgeverNaam: "Eva Braem",
    vergelijkingspunten: [{ id: "a", adres: "Heistraat 99", belastbareGrondslag: "325000", meetellen: true }, { id: "b", meetellen: false }],
  };
  it("geeft het aantal vergelijkingspunten mee, maar geen adressen, prijzen of namen", () => {
    const p = bouwMotiveringPrompt(d, berekenWaardering(d));
    expect(p).toContain('"Analytische methode"');
    expect(p).toContain("Aantal vergelijkingspunten in het dossier: 1");
    for (const verboden of ["Heistraat", "325000", "Eva Braem", "Kerkstraat"]) expect(p).not.toContain(verboden);
  });
  it("verschijnt enkel bij een andere dan de vergelijkende methode, en enkel voor de platform-beheerder", () => {
    const s = lees("src/stappen/StepVergelijkingspunten.jsx");
    expect(s).toContain("{!vergelijkend && aiTekst && (");
    expect(lees("src/schermen/DossierWizard.jsx")).toContain("aiTekst={magAiConclusie(user)}");
  });
  it("de kwaliteitsscore vraagt de motivering enkel als het veld bestaat", () => {
    const vgl = berekenKwaliteit({ ...d, wijzeVanWaardering: "Vergelijkende methode", wijzeVanWaarderingMotivering: "" }, null);
    const tekst = vgl.groepen.flatMap((g) => g.ontbreekt.map((o) => o.tekst)).join(" | ");
    expect(tekst).not.toContain("Motivering waarom");
    const ana = berekenKwaliteit({ ...d, wijzeVanWaarderingMotivering: "" }, null);
    expect(ana.groepen.flatMap((g) => g.ontbreekt.map((o) => o.tekst)).join(" | ")).toContain("Motivering waarom niet de vergelijkende methode gebruikt werd");
  });
});

describe("bewaarde handtekening", () => {
  it("met één klik plaatsen, en bewaren vanuit een dossier", () => {
    const o = lees("src/stappen/StepOpdracht.jsx");
    expect(o).toContain("Plaats mijn bewaarde handtekening");
    expect(o).toContain("Bewaar deze handtekening voor volgende verslagen");
    expect(lees("src/schermen/DossierWizard.jsx")).toContain("onBewaarHandtekening={onBewaarVoorkeuren ? (h) => onBewaarVoorkeuren({ handtekening: h }) : null}");
  });
  it("SQL: een aparte tabel die enkel de gebruiker zelf kan lezen en wijzigen", () => {
    const sql = lees("supabase/persoonlijke-voorkeuren.sql");
    expect(sql).toContain("create table if not exists public.profiel_voorkeuren");
    for (const actie of ["select", "insert", "update", "delete"]) expect(sql).toMatch(new RegExp(`for ${actie} to authenticated (using|with check) \\(user_id = auth.uid\\(\\)\\)`));
    expect(sql).not.toMatch(/is_beheerder|mag_kantoor_beheren/);
    expect(lees("supabase/schema.sql").trimEnd().endsWith(sql.trimEnd())).toBe(true);
  });
});
