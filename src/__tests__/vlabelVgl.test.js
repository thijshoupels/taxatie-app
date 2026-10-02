// Tests voor domein/vlabelVgl.js: Vlabel-verkoopprijzen inlezen, per verkoop beoordelen t.o.v.
// het te schatten goed (vaste regels, geen AI) en per verkoop een geschreven toelichting opstellen.
// Alle gegevens hier zijn verzonnen.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { leesXls } from "../lib/xlsLezen.js";
import {
  leesVlabelLijst, oppervlakteUitOmschrijving, onderwerpUitDossier, beoordeelVerkoop, beoordeelLijst,
  naarVergelijkingspunt, leesbareAfdeling, afstandKm,
} from "../domein/vlabelVgl.js";
import { voorbeeldXls } from "./fixtures/vlabelVoorbeeld.js";

const VANDAAG = "2026-09-30";
// bedragen worden met de Belgische notatie geschreven (harde spatie na het €-teken)
const plat = (s) => s.replace(/[\u00a0\u202f]/g, " ");
const KOP = ["Nr verkoopprijs", "Gemeente - afdeling", "Straat/ plaatsnaam", "Huisnr", "Detail", "CaPaKey perceel", "Partitiecode",
  "Belastbare oppv. Kad perceel", "Niet belastbare oppv. Kad perceel", "KI", "Aard kadaster", "Constructietype", "Verdiepingen",
  "Dakverdiep", "Bouwjaar", "Laatste aanp", "Garages", "Wooneenheden", "Beb. Grondoppv.", "Nuttige oppv.", "Ref bronakte",
  "Omschrijving goed", "Aktedatum verkoop", "Oppervlakte volgens akte", "Prijs\n (+lasten \n-voordelen)", "Totale nuttige opp",
  "Totale opp kad percelen", "Prijs/m²"];

// één verkoop (één perceel) als rij in Vlabel-formaat; datum als ISO-tekst (ook aanvaard)
function rij(o = {}) {
  const x = {
    nr: 1, afdeling: "VOORBEELDSTAD  1 AFD", straat: "Proefstraat", huisnr: "1", capakey: "99001A0001/00A000", opp: 800, ki: 900,
    aard: "HUIS", constructietype: "huis ZONDER bewoonbare kelder", bouwjaar: "1975", aanp: "", wooneenheden: 1, nuttig: 180,
    datum: "2025-10-01", prijs: 400000, omschrijving: "", ...o,
  };
  return [x.nr, x.afdeling, x.straat, x.huisnr, "", x.capakey, "P0000", x.opp, 0, x.ki, x.aard, x.constructietype, 2, "N",
    x.bouwjaar, x.aanp, 1, x.wooneenheden, 120, x.nuttig, `REF${x.nr}`, x.omschrijving, x.datum, null, x.prijs, x.nuttig, x.opp, ""];
}
const lijstVan = (...rijen) => leesVlabelLijst([{ naam: "VERKOOPPRIJZEN", rijen: [KOP, ...rijen] }]);
const eerste = (...rijen) => lijstVan(...rijen).verkopen[0];

const onderwerp = (extra = {}) => onderwerpUitDossier({
  pandType: "Woning", bouwtype: "Open", bouwjaar: "1975", grondopp: "800", bewoonbareOppSchatting: "", capakey: "99001A0999/00Z000",
  referentiedatum: "2026-09-30", ...extra,
}, { totOppNaCoeff: 180 }, VANDAAG);

describe("leesVlabelLijst", () => {
  const lijst = leesVlabelLijst(leesXls(voorbeeldXls()).bladen);

  it("groepeert de rijen per verkoop (één verkoop kan meerdere percelen hebben)", () => {
    expect(lijst.verkopen.map((v) => v.nr)).toEqual(["1", "2", "3", "4"]);
    const v2 = lijst.verkopen[1];
    expect(v2.percelen.length).toBe(2);
    expect(v2.grondOpp).toBe(1050);
    expect(v2.adres).toBe("Testlaan 3");
  });

  it("leest de afleverdatum en de opmerking van Vlabel bij aflevering", () => {
    expect(lijst.afgeleverdOp).toBe("2026-09-30");
    expect(lijst.opmerkingAflevering).toBe("Testlijst: zoekcriteria uitgebreid naar de hele gemeente.");
  });

  it("zet de afdeling om naar een leesbare plaatsnaam", () => {
    expect(lijst.verkopen[2].plaats).toBe("Dorp (Anderstad, afd. 2)");
    expect(leesbareAfdeling("TEMSE  3 AFD/STEENDORP/")).toBe("Steendorp (Temse, afd. 3)");
    expect(leesbareAfdeling("TEMSE  2 AFD")).toBe("Temse (afd. 2)");
  });

  it("weigert een bestand zonder de Vlabel-kolommen", () => {
    expect(() => leesVlabelLijst([{ naam: "Blad1", rijen: [["Naam", "Prijs"], ["x", 1]] }])).toThrow();
  });
});

describe("oppervlakteUitOmschrijving", () => {
  it("herkent aren/centiaren en m², ook met duizendtallen en decimalen", () => {
    expect(oppervlakteUitOmschrijving("Temse 1ste afd.: huis, Hoogkamerstraat 228, 26a 05ca")).toBe(2605);
    expect(oppervlakteUitOmschrijving('woonhuis "Vroonhoflaan 8"   oppervlakte 07a80ca')).toBe(780);
    expect(oppervlakteUitOmschrijving("woonhuis Kruibekestraat 137: 1.206m².")).toBe(1206);
    expect(oppervlakteUitOmschrijving("huis, Grensstraat 1, 2467,35m²")).toBe(2467.35);
    expect(oppervlakteUitOmschrijving("huis gelegen Doornstraat 47. 112m² en 558m².")).toBe(670);
    expect(oppervlakteUitOmschrijving("Heirbaan 524, woonhuis")).toBeNull();
  });
  it("verwart een huisnummer vlak vóór de oppervlakte niet met een duizendtal", () => {
    expect(oppervlakteUitOmschrijving("huis  Daalstraat 4 556m²", 556)).toBe(556);
    expect(oppervlakteUitOmschrijving("Heirstraat 31 en 31+ - 10 202m²", 10505)).toBe(10202);
  });
});

describe("beoordeelVerkoop — uitsluitingen", () => {
  it("sluit een gemengde verkoop (woning + magazijn) uit, met de reden", () => {
    const v = eerste(rij(), rij({ aard: "MAGAZIJN", constructietype: "Nijverheidsgebouw", opp: 10202, nuttig: 0, straat: "Proefstraat", huisnr: "1 +" }));
    const b = beoordeelVerkoop(v, onderwerp(), { vandaagIso: VANDAAG });
    expect(b.status).toBe("uitgesloten");
    expect(b.toelichting).toContain("gemengde verkoop");
    expect(b.toelichting).toContain("magazijn op 10.202 m²");
  });

  it('sluit een prijs met "FOUTE WAARDE" uit', () => {
    const b = beoordeelVerkoop(eerste(rij({ prijs: "FOUTE WAARDE" })), onderwerp(), { vandaagIso: VANDAAG });
    expect(b.status).toBe("uitgesloten");
    expect(b.toelichting).toContain("FOUTE WAARDE");
  });

  it("sluit een woning uit als het te schatten goed een appartement is", () => {
    const b = beoordeelVerkoop(eerste(rij()), onderwerp({ pandType: "Appartement" }), { vandaagIso: VANDAAG });
    expect(b.status).toBe("uitgesloten");
    expect(b.toelichting).toContain("ander type goed");
  });

  it("sluit een verkoop uit bij meer dan 40% verschil in gewogen nuttige oppervlakte", () => {
    const b = beoordeelVerkoop(eerste(rij({ nuttig: 260 })), onderwerp(), { vandaagIso: VANDAAG });
    expect(b.status).toBe("uitgesloten");
    expect(b.toelichting).toContain("wijkt 44% af");
  });

  it("maakt van een verkoop net buiten de 2 jaar een reservepunt, en sluit oudere uit", () => {
    expect(beoordeelVerkoop(eerste(rij({ datum: "2024-08-28" })), onderwerp(), { vandaagIso: VANDAAG }).status).toBe("reserve");
    expect(beoordeelVerkoop(eerste(rij({ datum: "2024-01-10" })), onderwerp(), { vandaagIso: VANDAAG }).status).toBe("uitgesloten");
  });

  it("rekent de periode vanaf de referentiedatum van het dossier, niet vanaf vandaag", () => {
    const o = onderwerp({ referentiedatum: "2024-06-01" });
    expect(beoordeelVerkoop(eerste(rij({ datum: "2023-01-10" })), o, { vandaagIso: VANDAAG }).status).not.toBe("uitgesloten");
  });
});

describe("beoordeelVerkoop — score en bebouwingsvorm", () => {
  it("leidt open bebouwing af uit de kadasterklasse 'villa' en meldt dat dit te bevestigen is", () => {
    const b = beoordeelVerkoop(eerste(rij({ constructietype: "villa" })), onderwerp(), { vandaagIso: VANDAAG });
    expect(b.status).toBe("relevant");
    expect(b.bebouwing.bron).toBe("afgeleid");
    expect(b.toelichting).toContain("net als het te schatten goed, een woning in open bebouwing is");
    expect(b.toelichting).toContain("te bevestigen door de schatter-expert");
  });

  it("vraagt om bevestiging als de bebouwingsvorm niet af te leiden is", () => {
    expect(beoordeelVerkoop(eerste(rij()), onderwerp(), { vandaagIso: VANDAAG }).status).toBe("bevestigen");
  });

  it("gebruikt de door de schatter bevestigde bebouwingsvorm", () => {
    const zelfde = beoordeelVerkoop(eerste(rij()), onderwerp(), { vandaagIso: VANDAAG, bevestigdeBebouwing: "Open" });
    expect(zelfde.toelichting).toContain("(bevestigd door de schatter-expert)");
    const anders = beoordeelVerkoop(eerste(rij()), onderwerp(), { vandaagIso: VANDAAG, bevestigdeBebouwing: "Gesloten" });
    expect(anders.score).toBeLessThan(zelfde.score);
    expect(anders.toelichting).toContain("woning in gesloten bebouwing is, terwijl het te schatten goed open bebouwd is");
  });

  it("neemt een onbruikbaar bouwjaar (bv. 0005) niet mee en meldt dat", () => {
    const b = beoordeelVerkoop(eerste(rij({ bouwjaar: "0005", constructietype: "villa" })), onderwerp(), { vandaagIso: VANDAAG });
    expect(b.nietBeoordeeld).toContain("bouwjaar");
    expect(b.toelichting).toContain('bouwjaar in de lijst ("0005") is onbruikbaar');
  });

  it("berekent de afstand uit coördinaten (Lambert 72, meter) en scoort binnen 1 km volledig", () => {
    const dichtbij = beoordeelVerkoop(eerste(rij({ constructietype: "villa" })), onderwerp(), { vandaagIso: VANDAAG, coordinaat: [100000, 200000], onderwerpCoordinaat: [100600, 200600] });
    const afstand = dichtbij.criteria.find((c) => c.sleutel === "afstand");
    expect(afstand.punten).toBe(15);
    expect(afstand.tekst).toBe("ca. 0,8 km");
    expect(dichtbij.toelichting).toContain("op ca. 0,8 km van het te schatten goed ligt");
    expect(afstandKm([100000, 200000], [103000, 204000])).toBeCloseTo(5, 5);
  });

  it("meldt gemengde grond (bv. boomgaard) en een verschil tussen omschrijving en kadaster als aandachtspunt", () => {
    const v = eerste(rij({ omschrijving: "woning, 25a 00ca", constructietype: "villa" }), rij({ aard: "BOOMGAARD HOOG", opp: 396, nuttig: 0, bouwjaar: "", wooneenheden: 0 }));
    const b = beoordeelVerkoop(v, onderwerp(), { vandaagIso: VANDAAG });
    expect(b.toelichting).toContain("396 m² boomgaard hoog");
    expect(b.toelichting).toContain("omschrijving in de akte vermeldt 2.500 m²");
  });

  it("scoort enkel op wat te beoordelen valt en zegt wat ontbreekt", () => {
    const o = onderwerpUitDossier({ pandType: "Woning", bouwtype: "Open", referentiedatum: VANDAAG }, { totOppNaCoeff: 0 }, VANDAAG);
    const b = beoordeelVerkoop(eerste(rij({ constructietype: "villa" })), o, { vandaagIso: VANDAAG });
    expect(b.nietBeoordeeld).toContain("gewogen nuttige opp.");
    expect(b.nietBeoordeeld).toContain("grondoppervlakte");
    expect(b.score).toBeGreaterThan(0);
  });
});

describe("geschreven toelichting per vergelijkingspunt", () => {
  it("noemt de concrete cijfers: adres, datum, prijs, prijs per m² en de vergelijking met het te schatten goed", () => {
    const b = beoordeelVerkoop(eerste(rij({ constructietype: "villa", nuttig: 200, opp: 760, bouwjaar: "1978", prijs: 450000 })), onderwerp(), { vandaagIso: VANDAAG });
    expect(b.toelichting).toContain("Proefstraat 1, Voorbeeldstad (afd. 1) — verkocht op 01/10/2025");
    expect(plat(b.toelichting)).toContain("€ 450.000");
    expect(plat(b.toelichting)).toContain("€ 2.250 per m² gewogen nuttige oppervlakte");
    expect(b.toelichting).toContain("de gewogen nuttige oppervlakte 200 m² bedraagt, 11% meer dan de 180 m² van het te schatten goed");
    expect(b.toelichting).toContain("het perceel 760 m² groot is, 5% kleiner dan dat van het te schatten goed (800 m²)");
    expect(b.toelichting).toContain("het gebouwd werd in 1978, 3 jaar later dan het te schatten goed (1975)");
  });

  it("zegt eerlijk welke verschillen er zijn", () => {
    const b = beoordeelVerkoop(eerste(rij({ constructietype: "villa", opp: 2272, bouwjaar: "1947" })), onderwerp(), { vandaagIso: VANDAAG });
    expect(b.toelichting).toContain("Er moet wel rekening gehouden worden met het feit dat");
    expect(b.toelichting).toContain("het perceel 2.272 m² groot is, 184% groter");
    expect(b.toelichting).toContain("28 jaar vroeger");
  });
});

describe("beoordeelLijst en overnemen", () => {
  it("zet de meest relevante verkopen eerst en de uitgesloten achteraan", () => {
    const lijst = leesVlabelLijst(leesXls(voorbeeldXls()).bladen);
    const r = beoordeelLijst(lijst, onderwerp(), { vandaagIso: VANDAAG });
    expect(r[0].verkoop.adres).toBe("Proefstraat 12");
    expect(r[0].beoordeling.status).toBe("relevant");
    expect(r[r.length - 1].beoordeling.status).toBe("uitgesloten");
  });

  it("vult bij overnemen de velden van een vergelijkingspunt in, met de toelichting als afweging", () => {
    const lijst = leesVlabelLijst(leesXls(voorbeeldXls()).bladen);
    const v = lijst.verkopen[0];
    const b = beoordeelVerkoop(v, onderwerp(), { vandaagIso: VANDAAG });
    const p = naarVergelijkingspunt(v, b, { afgeleverdOp: lijst.afgeleverdOp });
    expect(p.adres).toBe("Proefstraat 12, Voorbeeldstad (afd. 1)");
    expect(p.datumTransactie).toBe("2025-11-03");
    expect(p.belastbareGrondslag).toBe("450000");
    expect(p.bouwjaar).toBe("1975");
    expect(p.bron).toBe("Vlabel — verkoopprijzen Patrimoniumdocumentatie (lijst afgeleverd op 30/09/2026), ref. bronakte 000000000001");
    expect(p.afweging).toBe(b.toelichting);
    expect(p.kadastraleGegevens).toContain("99001A0001/00A000 (huis, 750 m²)");
    // nodig voor de waardering volgens de vergelijkende methode
    expect(p.nuttigeOpp).toBe("180");
    expect(p.grondOpp).toBe("750");
    expect(p.weging).toBe("1");
  });
});
