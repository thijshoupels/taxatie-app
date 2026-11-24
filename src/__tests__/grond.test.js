// Tests voor de vastgoedtypes "Bouwgrond / grond" en "Landbouwgrond": grond zonder gebouw. De
// waarde is de grondwaarde per schijf (zonder Abex of vetusteit), met een optionele, zelf bepaalde
// pachtcorrectie bij verpachte landbouwgrond; de wizard, het verslag, de kwaliteitsscore, de
// controles en de Vlabel-vergelijkingspunten laten alles over een gebouw weg.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import {
  GROND, LANDBOUWGROND, isGrond, isLandbouwgrond, isZonderGebouw, categorieVan, typeVan, PAND_PER_GRONDTYPE, normaliseerType,
} from "../domein/vastgoedtypes.js";
import { berekenWaardering, rapportWaarderingsBlokken, rapportGrondTypeRijen } from "../domein/waardering.js";
import { initialData, maakLeegPand, OPTS } from "../constants.js";
import { buildReportData } from "../rapport/bouwers.js";
import { berekenKwaliteit } from "../domein/kwaliteit.js";
import { inhoudelijkeControles } from "../domein/controles.js";
import { epcRegime } from "../domein/epc.js";
import { onderwerpUitDossier, beoordeelVerkoop } from "../domein/vlabelVgl.js";
import { genereerAutomatischeSwot, buildPropertySummary } from "../data/ai.js";
import fs from "node:fs";
import path from "node:path";

const schijven = [
  { id: 1, naam: "Eerste 50 meter", opp: "500", prijs: "250" },
  { id: 2, naam: "Tuingrond", opp: "300", prijs: "40" },
];
const grond = (extra = {}) => ({ ...initialData, vastgoedType: GROND, pandType: "Bouwgrond", grondopp: "800", schijven, ...extra });
const landbouw = (extra = {}) => ({
  ...initialData, vastgoedType: LANDBOUWGROND, pandType: "Weiland", grondopp: "12000",
  schijven: [{ id: 1, naam: "Weiland", opp: "12000", prijs: "6" }], ...extra,
});

describe("vastgoedtypes grond", () => {
  it("staan in de keuzelijst met een eigen Pand-lijst en categorie", () => {
    expect(OPTS.vastgoedType).toContain(GROND);
    expect(OPTS.vastgoedType).toContain(LANDBOUWGROND);
    expect(normaliseerType(GROND)).toBe(GROND);
    expect(isGrond(grond())).toBe(true);
    expect(isGrond(landbouw())).toBe(true);
    expect(isLandbouwgrond(landbouw())).toBe(true);
    expect(isLandbouwgrond(grond())).toBe(false);
    expect(isZonderGebouw(grond())).toBe(true);
    expect(isZonderGebouw({ vastgoedType: "Garage / Staanplaats" })).toBe(true);
    expect(isZonderGebouw({ vastgoedType: "Residentieel" })).toBe(false);
    expect(categorieVan(grond())).toBe("grond");
    expect(typeVan(landbouw())).toBe(LANDBOUWGROND);
    expect(PAND_PER_GRONDTYPE[GROND]).toContain("Bouwgrond");
    expect(PAND_PER_GRONDTYPE[LANDBOUWGROND]).toContain("Weiland");
    expect(OPTS.pachtSituatie).toEqual(["Vrij van pacht", "Verpacht"]);
  });

  it("nieuwe dossiers en extra panden hebben de pachtvelden", () => {
    for (const d of [initialData, maakLeegPand()]) {
      expect(d.pachtSituatie).toBe("");
      expect(d.pachtToelichting).toBe("");
      expect(d.pachtcorrectiePct).toBe("");
    }
  });
});

describe("waardering van grond", () => {
  it("is enkel de grondwaarde: geen gebouw, Abex of vetusteit", () => {
    const c = berekenWaardering(grond());
    expect(c.isGrond).toBe(true);
    expect(c.nieuwbouwwaarde).toBe(0);
    expect(c.actueleWaardeGebouw).toBe(0);
    expect(c.grondwaarde).toBe(500 * 250 + 300 * 40);
    expect(c.intrinsiek).toBe(137000);
    expect(c.venaleWaarde).toBe(137000);
    // geen controlepunten over ruimtes/oppervlakte na coëfficiënten of een Abex-waarde
    expect(c.controlePunten.some((t) => /ruimte|coëfficiënten|ABEX|klasse/i.test(t))).toBe(false);
    expect(c.oppCheck).toBe(true);
  });

  it("aanhorigheden tellen mee, een energiecorrectie niet", () => {
    const c = berekenWaardering(grond({
      aanhorigheden: [{ id: 1, omschrijving: "Afsluiting en poort", waarde: "3000" }],
      energiecorrectieActief: true, energiecorrectiePct: "-5",
    }));
    expect(c.intrinsiek).toBe(140000);
    expect(c.energiecorrectieBedrag).toBe(0);
    expect(c.venaleWaarde).toBe(140000);
  });

  it("meldt een ontbrekende grondoppervlakte en een grondwaarde van 0", () => {
    const c = berekenWaardering(grond({ grondopp: "", schijven: [{ id: 1, naam: "x", opp: "", prijs: "" }] }));
    expect(c.controlePunten).toContain("grondoppervlakte ontbreekt");
    expect(c.controlePunten.some((t) => /grondwaarde is nog 0/.test(t))).toBe(true);
  });

  it("pachtcorrectie enkel bij verpachte landbouwgrond en enkel als ze ingevuld is", () => {
    expect(berekenWaardering(landbouw()).grondwaarde).toBe(72000);
    expect(berekenWaardering(landbouw({ pachtSituatie: "Verpacht" })).grondwaarde).toBe(72000);
    const c = berekenWaardering(landbouw({ pachtSituatie: "Verpacht", pachtcorrectiePct: "30" }));
    expect(c.pachtcorrectieBedrag).toBeCloseTo(21600, 6);
    expect(c.grondwaarde).toBeCloseTo(50400, 6);
    expect(c.intrinsiek).toBeCloseTo(50400, 6);
    // vrij van pacht of een ander vastgoedtype: het veld doet niets
    expect(berekenWaardering(landbouw({ pachtSituatie: "Vrij van pacht", pachtcorrectiePct: "30" })).grondwaarde).toBe(72000);
    expect(berekenWaardering(grond({ pachtSituatie: "Verpacht", pachtcorrectiePct: "30" })).grondwaarde).toBe(137000);
    // begrensd tussen 0 en 100%
    expect(berekenWaardering(landbouw({ pachtSituatie: "Verpacht", pachtcorrectiePct: "150" })).grondwaarde).toBe(0);
  });

  it("verandert niets aan een woning met dezelfde schijven", () => {
    const woning = { ...initialData, schijven, grondopp: "800", pachtSituatie: "Verpacht", pachtcorrectiePct: "30" };
    const c = berekenWaardering(woning);
    expect(c.isGrond).toBe(false);
    expect(c.grondwaarde).toBe(137000);
    expect(c.pachtcorrectieBedrag).toBe(0);
    expect(c.actueleWaardeGebouw).toBe(berekenWaardering({ ...woning, pachtSituatie: "", pachtcorrectiePct: "" }).actueleWaardeGebouw);
  });
});

describe("verslag van grond", () => {
  it("waarderingsblok toont de schijven, de pachtcorrectie en de grondwaarde", () => {
    const d = landbouw({ pachtSituatie: "Verpacht", pachtcorrectiePct: "30" });
    const [blok] = rapportWaarderingsBlokken(d, berekenWaardering(d));
    expect(blok.titel).toBe("Waardering landbouwgrond");
    const labels = blok.rijen.map((r) => r[0]);
    expect(labels[0]).toMatch(/^Weiland \(12\.000 m² × €\s6\/m²\)$/);
    // een prijs per m² met decimalen wordt niet afgerond
    const d2 = landbouw({ schijven: [{ id: 1, naam: "Akker", opp: "12450", prijs: "6.5" }] });
    expect(rapportWaarderingsBlokken(d2, berekenWaardering(d2))[0].rijen[0][0]).toMatch(/^Akker \(12\.450 m² × €\s6,50\/m²\)$/);
    expect(labels.some((l) => /^Pachtcorrectie \(verpacht, −30,00%\)$/.test(l))).toBe(true);
    expect(labels).toContain("Grondwaarde");
    expect(labels.some((l) => /vetusteit|Abex|Nieuwbouwwaarde|gebouw/i.test(l))).toBe(false);
    const [blokGrond] = rapportWaarderingsBlokken(grond(), berekenWaardering(grond()));
    expect(blokGrond.titel).toBe("Waardering van de grond");
  });

  it("PDF-verslag laat de gebouwsecties en -rijen weg", () => {
    const d = landbouw({ straat: "Veldweg", gemeente: "Temse", pachtSituatie: "Verpacht", pachtToelichting: "Pacht sinds 2015" });
    const html = buildReportData(d, berekenWaardering(d), undefined).sectionsBlockHtml;
    for (const weg of ["Constructie &amp; isolatie", "Constructie & isolatie", "Verwarming", "Interieur", "Bedrijfskenmerken", "Bouwlaag", "Bewoonbare oppervlakte", "Lift", "Bouwjaar"]) {
      expect(html.includes(weg)).toBe(false);
    }
    expect(html).toMatch(/Afmetingen van het perceel/);
    expect(html).toMatch(/Pachtsituatie/);
    expect(html).toMatch(/Pacht sinds 2015/);
    expect(html).toMatch(/Waardering landbouwgrond/);
  });

  it("type-rijen: pacht enkel bij landbouwgrond, toelichting enkel als verpacht", () => {
    expect(rapportGrondTypeRijen(grond()).some((r) => /Pacht/.test(r[0]))).toBe(false);
    expect(rapportGrondTypeRijen(landbouw({ pachtSituatie: "Vrij van pacht" })).map((r) => r[0])).toContain("Pachtsituatie");
    expect(rapportGrondTypeRijen(landbouw({ pachtSituatie: "Vrij van pacht" })).map((r) => r[0])).not.toContain("Toelichting pacht");
  });
});

describe("kwaliteit, controles, EPC en SWOT bij grond", () => {
  it("geen EPC, bouwjaar of staat in de kwaliteitsscore; wel de pachtsituatie bij landbouwgrond", () => {
    expect(epcRegime(grond())).toBe("geen");
    expect(epcRegime({ vastgoedType: "Residentieel" })).toBe("residentieel");
    const tips = (d) => berekenKwaliteit(d, berekenWaardering(d)).groepen.flatMap((g) => g.ontbreekt.map((o) => o.tekst));
    const t = tips(grond());
    expect(t.filter((x) => /bouwjaar|staat van het pand|EPC/i.test(x))).toEqual([]);
    expect(t.some((x) => /bouwjaar|staat van het pand|EPC/i.test(x))).toBe(false);
    expect(tips(landbouw())).toContain("Pachtsituatie (vrij van pacht of verpacht)");
    // geen huisnummer nodig bij grond
    const zonderNr = { straat: "Veldweg", nummer: "", postcode: "9140", gemeente: "Temse" };
    expect(tips(landbouw(zonderNr)).some((x) => /^Volledig adres/.test(x))).toBe(false);
    expect(tips({ ...initialData, ...zonderNr }).some((x) => /^Volledig adres/.test(x))).toBe(true);
    expect(tips(landbouw({ pachtSituatie: "Verpacht" })).includes("Pachtsituatie (vrij van pacht of verpacht)")).toBe(false);
  });

  it("controles: geen vetusteit-melding, wel bestemming en pacht", () => {
    const c = (d) => inhoudelijkeControles(d, berekenWaardering(d));
    expect(c(grond()).some((t) => /Vetusteit/.test(t))).toBe(false);
    expect(c(grond({ gewestplan: "Agrarisch gebied" })).some((t) => /^Bouwgrond in agrarisch gebied/.test(t))).toBe(true);
    expect(c(grond({ gewestplan: "Agrarisch gebied", pandType: "Tuingrond / restperceel" })).some((t) => /^Bouwgrond/.test(t))).toBe(false);
    expect(c(landbouw({ pachtSituatie: "Verpacht" })).some((t) => /^Verpachte landbouwgrond/.test(t))).toBe(true);
    expect(c(landbouw({ pachtSituatie: "Verpacht", pachtToelichting: "pacht 2015" })).some((t) => /^Verpachte/.test(t))).toBe(false);
    // een woning met onbekend bouwjaar krijgt de vetusteit-melding nog steeds
    expect(c({ ...initialData }).some((t) => /^Vetusteit van/.test(t))).toBe(true);
  });

  it("SWOT-voorstel en AI-context zonder gebouwkenmerken", () => {
    const s = genereerAutomatischeSwot(landbouw({ pachtSituatie: "Verpacht" }));
    const alles = [...s.sterktes, ...s.zwaktes, ...s.kansen, ...s.bedreigingen].join(" ");
    expect(alles).not.toMatch(/isolatie|keuring|zonnepanelen|EPC|beglazing/i);
    expect(s.bedreigingen.some((t) => /verpacht/i.test(t))).toBe(true);
    const ctx = buildPropertySummary(landbouw({ pachtSituatie: "Verpacht", pachtToelichting: "Pachter Jan Janssens" }));
    expect(ctx).toMatch(/Pachtsituatie: Verpacht/);
    expect(ctx).not.toMatch(/Janssens|Ruwbouw|Verwarming|slaapkamers/);
  });
});

describe("Vlabel-vergelijkingspunten bij grond", () => {
  const perceel = (aard, extra = {}) => ({ capakey: "46020A0001/00A000", aard, constructietype: "", opp: 900, wooneenheden: 0, nuttigeOpp: 0, bouwjaar: "", laatsteAanpassing: "", ...extra });
  const verkoop = (percelen, extra = {}) => ({
    nr: 1, adres: "Veldweg 1", plaats: "Temse", datum: "2026-03-01", prijs: 180000, prijsTekst: "180000",
    percelen, hoofdIdx: 0, nuttigeOpp: null, grondOpp: 900, oppOmschrijving: null, afdelingscode: "46020", ...extra,
  });
  const o = (d) => onderwerpUitDossier({ ...d, referentiedatum: "2026-06-01", capakey: "46020B0001/00A000" }, berekenWaardering(d), "2026-06-01");

  it("het te schatten goed is grond: geen nuttige oppervlakte of bouwjaar", () => {
    const og = o(grond({ bouwjaar: "1980" }));
    expect(og.hoofdtype).toBe("grond");
    expect(og.landbouw).toBe(false);
    expect(og.nuttigeOpp).toBe(null);
    expect(og.bouwjaar).toBe(null);
    expect(og.grondOpp).toBe(800);
    expect(o(landbouw()).landbouw).toBe(true);
  });

  it("verkochte bouwgrond is relevant, beoordeeld op afstand, grond en recentheid, met prijs per m² grond", () => {
    const b = beoordeelVerkoop(verkoop([perceel("BOUWGROND")]), o(grond()), { vandaagIso: "2026-06-01" });
    expect(b.status).toBe("relevant");
    expect(b.criteria.map((c) => c.sleutel).sort()).toEqual(["afstand", "grond", "recentheid"]);
    expect(b.prijsPerM2Grond).toBe(200);
    expect(b.prijsPerM2Nuttig).toBe(null);
    expect(b.toelichting).toMatch(/€\s200 per m² grond/);
    expect(b.toelichting).not.toMatch(/woning met tuin|bouwjaar/);
  });

  it("een verkoop met een woning of het andere soort grond is een aandachtspunt, geen uitsluiting", () => {
    const metWoning = beoordeelVerkoop(verkoop([perceel("HUIS", { wooneenheden: 1 })]), o(grond()), { vandaagIso: "2026-06-01" });
    expect(metWoning.status).toBe("minder");
    expect(metWoning.uitsluitingen).toEqual([]);
    expect(metWoning.aandachtspunten.join(" ")).toMatch(/omvat een woning/);
    const weiland = beoordeelVerkoop(verkoop([perceel("WEILAND")]), o(grond()), { vandaagIso: "2026-06-01" });
    expect(weiland.status).toBe("minder");
    expect(weiland.aandachtspunten.join(" ")).toMatch(/wijst op landbouwgrond/);
    const bouwgrondVoorLandbouw = beoordeelVerkoop(verkoop([perceel("BOUWGROND")]), o(landbouw()), { vandaagIso: "2026-06-01" });
    expect(bouwgrondVoorLandbouw.aandachtspunten.join(" ")).toMatch(/omvat bouwgrond/);
    const weilandVoorLandbouw = beoordeelVerkoop(verkoop([perceel("WEILAND", { opp: 11000 })], { grondOpp: 11000 }), o(landbouw()), { vandaagIso: "2026-06-01" });
    expect(weilandVoorLandbouw.status).toBe("relevant");
  });

  it("een verkoop met een bedrijfsgebouw blijft uitgesloten, met 'de grond' in de uitleg", () => {
    const b = beoordeelVerkoop(verkoop([perceel("BOUWGROND"), perceel("MAGAZIJN")]), o(grond()), { vandaagIso: "2026-06-01" });
    expect(b.status).toBe("uitgesloten");
    expect(b.uitsluitingen[0]).toMatch(/betrekking op de grond\.$/);
  });
});

describe("wizard en schermen", () => {
  const bron = (f) => fs.readFileSync(path.join(process.cwd(), "src", f), "utf8");
  it("grond krijgt de ingekorte wizard zonder gebouwtabbladen", () => {
    const w = bron("schermen/DossierWizard.jsx");
    expect(w).toMatch(/const isGarageStaanplaats = isZonderGebouw\(actief\.pd\);/);
    expect(w).toMatch(/grondDossier \? "Perceel & grondwaarde" : "Afmetingen & indeling"/);
  });
  it("Type-tabblad: pachtvelden bij landbouwgrond, geen bouwjaar/lift bij grond", () => {
    const t = bron("stappen/StepType.jsx");
    expect(t).toMatch(/\{landbouw && \(/);
    expect(t).toMatch(/label="Pachtsituatie"/);
    expect(t).toMatch(/\{!grondDossier && \(\s*<>\s*<Field label="Bouwtype"/);
  });
  it("Waardering-tabblad: eigen sectie, geen huurwaarde- of energiecorrectie-sectie bij grond", () => {
    const s = bron("stappen/StepWaardering.jsx");
    expect(s).toMatch(/\{grondDossier \? \(\s*<Section title=\{isLandbouwgrond\(d\) \? "Waarde van de landbouwgrond" : "Waarde van de grond"\}/);
    expect(s).toMatch(/!isResidentieel && !isGarageStaanplaats && !grondDossier && \(\s*<Section title="Huurwaardebenadering"/);
    expect(s).toMatch(/\{!grondDossier && \(\s*<Section title="Energiecorrectie \(optioneel\)"/);
  });
});
