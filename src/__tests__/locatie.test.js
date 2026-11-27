// Tests voor domein/locatie.js: de ligging van een pand zonder adres (bv. een grond) via de CaPaKey
// — Lambert 72 → GPS, de kaart, de AI-opzoeking van de omgeving, de naam van het dossier — en hoe
// het verslag, de controle vóór aflevering en de kwaliteitsscore daarmee omgaan.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  heeftAdres, perceelMiddelpunt, lambert72NaarWgs84, perceelLocatie, kaartLocatie, liggingVoorAi,
  liggingSleutel, pandNaamKort, adresVoorVerslag,
} from "../domein/locatie.js";
import { initialData } from "../constants.js";
import { valideerDossier } from "../App.jsx";
import { berekenWaardering } from "../domein/waardering.js";
import { berekenKwaliteit } from "../domein/kwaliteit.js";
import { buildReportData } from "../rapport/bouwers.js";
import { buildPropertySummary } from "../data/ai.js";
import { bouwConclusieContext } from "../data/aiConclusie.js";

const lees = (f) => fs.readFileSync(path.join(process.cwd(), "src", f), "utf8");
// een vierkant perceel van 100 × 100 m rond (130000, 205000) in Lambert 72
const ring = [[129950, 204950], [130050, 204950], [130050, 205050], [129950, 205050], [129950, 204950]];
const grond = (extra = {}) => ({
  ...initialData, vastgoedType: "Landbouwgrond", pandType: "Weiland", straat: "", nummer: "", postcode: "9140", gemeente: "Temse",
  capakey: "46020B0127/00Z000", cadgisRingen: [ring], cadgisCapakeyOpgezocht: "46020B0127/00Z000",
  schijven: [{ id: 1, naam: "Weiland", opp: "10000", prijs: "6" }], grondopp: "10000", ...extra,
});

describe("Lambert 72 → GPS", () => {
  it("projectie klopt met het rekenvoorbeeld van EPSG (Belge Lambert 72)", () => {
    // EPSG Guidance Note 7-2: 50°40'46.461"N 5°48'26.533"E (BD72) ↔ E 251763,20 / N 153034,13.
    // Na de datumverschuiving naar WGS84 ligt het punt ca. 60-100 m verder (BD72 ≠ WGS84).
    const l = lambert72NaarWgs84(251763.20, 153034.13);
    const bd72 = { lat: 50 + 40 / 60 + 46.461 / 3600, lon: 5 + 48 / 60 + 26.533 / 3600 };
    const meterNoord = (l.lat - bd72.lat) * 111200, meterOost = (l.lon - bd72.lon) * 111200 * Math.cos(50.68 * Math.PI / 180);
    expect(Math.hypot(meterNoord, meterOost)).toBeGreaterThan(50);
    expect(Math.hypot(meterNoord, meterOost)).toBeLessThan(150);
  });
  it("Grote Markt Brussel en een punt in het Waasland", () => {
    const bxl = lambert72NaarWgs84(148800, 170700);
    expect(bxl.lat).toBeCloseTo(50.8467, 3);
    expect(bxl.lon).toBeCloseTo(4.3517, 3);
    const temse = lambert72NaarWgs84(130000, 205000);
    expect(temse.lat).toBeGreaterThan(51.1); expect(temse.lat).toBeLessThan(51.2);
    expect(temse.lon).toBeGreaterThan(4.0); expect(temse.lon).toBeLessThan(4.3);
    expect(lambert72NaarWgs84(NaN, 1)).toBe(null);
  });
  it("middelpunt van het perceel", () => {
    expect(perceelMiddelpunt([ring.slice(0, 4)])).toEqual([130000, 205000]);
    expect(perceelMiddelpunt([])).toBe(null);
    expect(perceelLocatie({})).toBe(null);
  });
});

describe("ligging: adres, of anders het perceel", () => {
  it("met een adres verandert er niets", () => {
    const d = { ...initialData, straat: "Kerkstraat", nummer: "4", bus: "", postcode: "9100", gemeente: "Sint-Niklaas", capakey: "x", cadgisRingen: [ring] };
    expect(heeftAdres(d)).toBe(true);
    expect(kaartLocatie(d)).toBe("Kerkstraat 4, 9100 Sint-Niklaas, België");
    // zelfde sleutel als voorheen: een al opgezochte omgeving blijft "al opgezocht"
    expect(liggingSleutel(d)).toBe("Kerkstraat 4, 9100 Sint-Niklaas, België");
    expect(liggingVoorAi(d)).toBe("het adres: Kerkstraat 4, 9100 Sint-Niklaas, België");
    expect(adresVoorVerslag(d)).toBe("Kerkstraat 4, 9100 Sint-Niklaas");
    expect(pandNaamKort(d)).toBe("Kerkstraat 4");
  });
  it("zonder adres: de GPS-ligging van het perceel", () => {
    const d = grond();
    expect(heeftAdres(d)).toBe(false);
    expect(kaartLocatie(d)).toMatch(/^51\.\d{6},4\.\d{6}$/);
    expect(liggingSleutel(d)).toBe("CaPaKey 46020B0127/00Z000");
    const ai = liggingVoorAi(d);
    expect(ai).toMatch(/^een perceel zonder huisadres in 9140 Temse, België — kadastraal perceel \(CaPaKey\) 46020B0127\/00Z000/);
    expect(ai).toContain(kaartLocatie(d));
    expect(adresVoorVerslag(d)).toBe("9140 Temse (perceel zonder adres — zie CaPaKey)");
    expect(pandNaamKort(d)).toBe("Perceel 46020B0127/00Z000");
    // met een straat maar zonder gemeente: de straat wordt vermeld
    expect(liggingVoorAi(grond({ straat: "Veldweg", gemeente: "" }))).toMatch(/zonder huisadres in 9140 \(langs Veldweg\)/);
  });
  it("zonder perceelsgeometrie (nog niet opgehaald) geen ligging", () => {
    const d = grond({ cadgisRingen: null });
    expect(kaartLocatie(d)).toBe(null);
    expect(liggingVoorAi(d)).toBe(null);
    expect(pandNaamKort(d)).toBe("Perceel 46020B0127/00Z000");
  });
});

describe("controle, kwaliteit, verslag en AI zonder adres", () => {
  it("gemeente + CaPaKey volstaat voor de controle vóór aflevering", () => {
    const zoek = (d) => valideerDossier(d).blokkerend.some((p) => p.startsWith("Adres van het pand"));
    expect(zoek(grond())).toBe(false);
    expect(zoek(grond({ capakey: "" }))).toBe(true);
    expect(zoek(grond({ gemeente: "" }))).toBe(true);
    expect(zoek({ ...initialData, straat: "Kerkstraat", gemeente: "Temse" })).toBe(false);
  });
  it("kwaliteitsscore: bij grond telt de CaPaKey als ligging", () => {
    const tips = (d) => berekenKwaliteit(d, berekenWaardering(d)).groepen.flatMap((g) => g.ontbreekt.map((o) => o.tekst));
    expect(tips(grond()).some((t) => /^Ligging|^Volledig adres/.test(t))).toBe(false);
    expect(tips(grond({ capakey: "" }))).toContain("Ligging (straat of CaPaKey, postcode en gemeente)");
  });
  it("verslag: adresregel en voorblad met het perceel", () => {
    const d = grond({ datumVerslag: "2026-10-12" });
    const r = buildReportData(d, berekenWaardering(d), undefined);
    expect(r.adres).toBe("9140 Temse (perceel zonder adres — zie CaPaKey)");
    expect(r.coverHtml).toContain("Perceel 46020B0127/00Z000");
    expect(r.coverHtml).not.toContain("Adres niet ingevuld");
    expect(r.sectionsBlockHtml).not.toMatch(/>\s*,\s*9140 Temse/);
  });
  it("AI-context: het perceel i.p.v. een leeg adres, in de conclusie enkel de gemeente", () => {
    const d = grond();
    expect(buildPropertySummary(d)).toMatch(/^Adres: geen huisadres — perceel \(CaPaKey\) 46020B0127\/00Z000, 9140 Temse$/m);
    const ctx = bouwConclusieContext(d, berekenWaardering(d));
    expect(ctx).toMatch(/^Ligging: 9140 Temse$/m);
    expect(ctx).not.toContain("46020B0127");
  });
});

describe("schermen", () => {
  it("AI-opzoeking van de omgeving werkt ook met enkel een CaPaKey", () => {
    const s = lees("stappen/StepLigging.jsx");
    expect(s).toMatch(/const viaPerceel = !adresVolledig && !!capakey;/);
    expect(s).toMatch(/await fetchCadgisPerceel\(capakey\)/);
    expect(s).toMatch(/omgeving en bereikbaarheid op voor \$\{ligging\}\./);
    expect(s).toMatch(/set\("liggingOpgezochtAdres"\)\(sleutel\)/);
    expect(s).toMatch(/"Opzoeken via AI \(op basis van de CaPaKey\)"/);
  });
  it("kaart op het tabblad Type en in het verslag volgt het perceel", () => {
    expect(lees("stappen/StepType.jsx")).toMatch(/const adres = kaartLocatie\(d\) \|\| "";/);
    expect(lees("rapport/bouwers.js")).toMatch(/\(kaartPlek && GOOGLE_MAPS_API_KEY\) \?\s*`<img src="\$\{wEsc\(buildStaticMapUrl\(kaartPlek\)\)\}"/);
    // het voorbeeld op het tabblad Rapport toont exact de HTML van bouwers.js
    expect(lees("rapport/StepRapport.jsx")).toMatch(/srcDoc=\{voorbeeldHtml\}/);
  });
  it("overzicht: CaPaKey mee opgehaald, met een terugval zonder", () => {
    const s = lees("data/dossiers.js");
    expect(s).toMatch(/capakey:data->>capakey/);
    expect(s).toMatch(/if \(error\) \{\s*\(\{ data, error \} = await supabase\.from\("dossiers"\)\.select\(KOLOMMEN\)/);
    expect(lees("schermen/Dashboard.jsx")).toMatch(/\{pandNaamKort\(x\) \|\| "Naamloos dossier"\}/);
  });
});
