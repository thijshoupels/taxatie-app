// Tests voor de vergelijkingsmethode (domein/vergelijking.js) en de inpassing ervan in de venale
// waarde, de prijsvork en het verslag (rekenregels versie 2).
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { berekenVergelijking } from "../domein/vergelijking.js";
import { berekenWaardering, rapportWaarderingsBlokken, rapportVglMelding } from "../domein/waardering.js";
import { buildPrintHtml } from "../rapport/bouwers.js";
import { initialData, HUISSTIJLEN } from "../constants.js";

const ref = (o) => ({ id: Math.random().toString(36).slice(2), prijsSoort: "Verkoopprijs (akte / transactie)", meetellen: true, ...o });
// vier verkochte referenties rond € 2.400/m² en een vraagprijs
const REFS = [
  ref({ adres: "Heistraat 99, Stekene", belastbareGrondslag: "500000", bewoonbareOpp: "200", datumTransactie: "2026-03-01" }),
  ref({ adres: "Vlasrootstraat 37, Stekene", belastbareGrondslag: "560000", bewoonbareOpp: "250", corrLiggingPct: "5", datumTransactie: "2026-01-15" }),
  ref({ adres: "Drieschouwen 64A, Stekene", belastbareGrondslag: "480000", bewoonbareOpp: "200", corrStaatPct: "-5", datumTransactie: "2026-05-10" }),
  ref({ adres: "Kerkstraat 2, Stekene", belastbareGrondslag: "720000", bewoonbareOpp: "280", corrStaatPct: "-10", datumTransactie: "2025-11-20" }),
];

describe("berekenVergelijking", () => {
  it("corrigeert per referentie en vergelijkt per m²", () => {
    const v = berekenVergelijking(REFS, { oppTeSchatten: 240, referentiedatum: "2026-08-01" });
    expect(v.basis).toBe("m2");
    expect(v.aantal).toBe(4);
    const r2 = v.rijen[1];
    expect(r2.gecorrigeerd).toBeCloseTo(560000 * 1.05, 6);
    expect(r2.perM2).toBeCloseTo(560000 * 1.05 / 250, 6);
    expect(r2.waarde).toBeCloseTo(560000 * 1.05 / 250 * 240, 6);
    const gem = v.rijen.reduce((s, r) => s + r.waarde, 0) / 4;
    expect(v.waarde).toBeCloseTo(gem, 6);
    // vanaf 4 referenties: middelste helft als spreiding
    expect(v.onder).toBeGreaterThan(Math.min(...v.rijen.map((r) => r.waarde)));
    expect(v.boven).toBeLessThan(Math.max(...v.rijen.map((r) => r.waarde)));
  });

  it("verrekent de onderhandelingsmarge op een vraagprijs en de indexatie", () => {
    const v = berekenVergelijking([ref({ prijsSoort: "Vraagprijs (te koop aangeboden)", belastbareGrondslag: "559000", bewoonbareOpp: "200", datumTransactie: "2025-08-01" })],
      { oppTeSchatten: 200, referentiedatum: "2026-08-01", onderhandelingsmargePct: 5, indexPctPerJaar: 2 });
    expect(v.rijen[0].gecorrigeerd).toBeCloseTo(559000 * 0.95 * Math.pow(1.02, v.rijen[0].jaren), 4);
    expect(v.waarschuwingen.join(" ")).toContain("Enkel vraagprijzen");
    expect(v.waarschuwingen.join(" ")).toContain("Slechts 1 bruikbare referentie");
  });

  it("laat referenties zonder prijs, zonder oppervlakte of uitgevinkt weg, en vergelijkt anders geheel tegen geheel", () => {
    const v = berekenVergelijking([...REFS.slice(0, 2), ref({ belastbareGrondslag: "400000" }), ref({ bewoonbareOpp: "150" }), ref({ belastbareGrondslag: "1", bewoonbareOpp: "1", meetellen: false })], { oppTeSchatten: 240 });
    expect(v.aantal).toBe(2);
    expect(v.rijen.map((r) => r.reden)).toEqual(["", "", "geen oppervlakte", "geen prijs", "niet meegenomen"]);
    const geheel = berekenVergelijking([ref({ belastbareGrondslag: "400000" }), ref({ belastbareGrondslag: "500000", corrLiggingPct: "-10" })], {});
    expect(geheel.basis).toBe("geheel");
    expect(geheel.waarde).toBeCloseTo((400000 + 450000) / 2, 6);
  });
});

describe("vergelijkingsmethode in de waardering en het verslag", () => {
  const villa = (o = {}) => ({
    ...initialData, extraPanden: [], parkeerplaatsenGarages: [], reden: "Echtscheiding", referentiedatum: "2026-08-01",
    ruimtes: [{ verdieping: "gelijkvloers", opp: "140", coeff: "1" }, { verdieping: "eerste", opp: "100", coeff: "1" }],
    schijven: [{ opp: "1321", prijs: "225" }], grondopp: "1321", vergelijkingspunten: REFS, ...o,
  });

  it("weegt standaard 60% mee bij een woning, naast 40% kostenbenadering", () => {
    const c = berekenWaardering(villa({ afrondingVenale: "Geen" }));
    expect(c.vergelijkingWaarde).toBeCloseTo(c.vergelijking.waarde, 6);
    expect(c.voorgesteldeVenaleWaarde).toBeCloseTo(0.4 * c.intrinsiek + 0.6 * c.vergelijkingWaarde, 6);
    expect(c.prijsvork.methodes.map((m) => m.sleutel)).toEqual(["analytisch", "vergelijking"]);
    expect(c.prijsvork.motivering).toContain("gewogen gemiddelde van de analytische methode (kostenbenadering) (40%) en de vergelijkingsmethode (60%)");
  });

  it("telt niet mee bij een andere wijze van waardering of in rekenversie 1", () => {
    expect(berekenWaardering(villa({ wijzeVanWaardering: "Analytische methode" })).vergelijkingWaarde).toBe(0);
    expect(berekenWaardering(villa({ rekenversie: 1 })).vergelijkingWaarde).toBe(0);
  });

  it("toont de referenties anoniem buiten een nalatenschap, met adres bij een nalatenschap", () => {
    const d = villa();
    const c = berekenWaardering(d);
    const blok = rapportWaarderingsBlokken(d, c).find((b) => b.titel === "Vergelijkingsmethode");
    expect(blok.tabel.rijen.map((r) => r[0])).toEqual(["Referentie 1", "Referentie 2", "Referentie 3", "Referentie 4"]);
    expect(JSON.stringify(blok)).not.toContain("Heistraat");
    expect(rapportVglMelding(d, c)).toBe("");
    const html = buildPrintHtml(d, c, HUISSTIJLEN.houpels);
    expect(html).toContain("Waarde volgens de vergelijkingsmethode");
    expect(html).not.toContain("VGL-punten (");
    const n = villa({ reden: "Nalatenschap" });
    const bn = rapportWaarderingsBlokken(n, berekenWaardering(n)).find((b) => b.titel === "Vergelijkingsmethode");
    expect(bn.tabel.rijen[0][0]).toBe("Heistraat 99, Stekene");
  });

  it("laat referenties uit een Vlabel-lijst buiten een nalatenschap weg uit het verslag", () => {
    const d = villa({ vergelijkingspunten: [...REFS, ref({ adres: "Geheim 1", belastbareGrondslag: "500000", bewoonbareOpp: "220", vlabelNr: 7, bron: "Vlabel — verkoopprijzen" })] });
    const c = berekenWaardering(d);
    const blok = rapportWaarderingsBlokken(d, c).find((b) => b.titel === "Vergelijkingsmethode");
    expect(blok.tabel.rijen).toHaveLength(4);
    expect(blok.motivering).toContain("1 referentie uit de Vlabel-verkoopprijzen wordt omwille van de GDPR niet weergegeven");
    expect(JSON.stringify(blok)).not.toContain("Geheim");
  });
});
