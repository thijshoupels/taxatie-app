// Tests voor lib/xlsLezen.js — de eigen lezer voor oude Excel-bestanden (.xls, BIFF8), gebruikt om
// de Vlabel-verkoopprijzenlijst in te lezen zonder extra npm-pakket. Het testbestand bevat
// verzonnen gegevens (zie fixtures/vlabelVoorbeeld.js). Tijdens de ontwikkeling werd de lezer ook
// cel per cel vergeleken met LibreOffice op een echte Vlabel-lijst (1.470 cellen, 0 verschillen);
// die echte lijst zit bewust NIET in de repo (vertrouwelijke gegevens, enkel voor die opdracht).
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { leesXls, excelDatumNaarIso } from "../lib/xlsLezen.js";
import { voorbeeldXls } from "./fixtures/vlabelVoorbeeld.js";

describe("leesXls", () => {
  const { bladen } = leesXls(voorbeeldXls());

  it("vindt alle werkbladen met hun naam", () => {
    expect(bladen.map((b) => b.naam)).toEqual(["VERKOOPPRIJZEN", "Lange teksten"]);
  });

  it("leest tekst, getallen en datums (als Excel-serienummer) uit de juiste cel", () => {
    const rij = bladen[0].rijen[10];
    expect(rij[0]).toBe(1);
    expect(rij[2]).toBe("Proefstraat");
    expect(rij[5]).toBe("99001A0001/00A000");
    expect(rij[19]).toBe(180);
    expect(rij[24]).toBe(450000);
    expect(excelDatumNaarIso(rij[22])).toBe("2025-11-03");
  });

  it("leest tekst met regeleinden en tekst in plaats van een getal (FOUTE WAARDE)", () => {
    expect(bladen[0].rijen[8][24]).toBe("Prijs\n (+lasten \n-voordelen)");
    expect(bladen[0].rijen[15][24]).toBe("FOUTE WAARDE");
  });

  it("leest de gedeelde tekstentabel ook wanneer die over meerdere vervolgrecords (CONTINUE) verdeeld is", () => {
    const lang = bladen[1].rijen;
    expect(lang.length).toBe(151);
    for (let i = 0; i < 150; i++) {
      expect(lang[i][0]).toBe(`Unieke testtekst nummer ${String(i).padStart(4, "0")} — met accenten éèà en wat opvulling om de tabel te laten groeien`);
    }
    expect(lang[150][0]).toBe("Laatste — ünïcödé ✓");
  });

  it("geeft van formules het bewaarde resultaat terug (getal en tekst)", () => {
    expect(bladen[0].rijen[19][36]).toBe(180);
    expect(bladen[0].rijen[19][37]).toBe("formule");
  });

  it("weigert een bestand dat geen oud Excel-bestand is, met een begrijpelijke melding", () => {
    const tekstBestand = new TextEncoder().encode("Nr verkoopprijs;Gemeente\n1;Temse\n");
    expect(() => leesXls(tekstBestand)).toThrow();
  });
});

describe("excelDatumNaarIso", () => {
  it("zet Excel-serienummers en geschreven datums om", () => {
    expect(excelDatumNaarIso(46001)).toBe("2025-12-10");
    expect(excelDatumNaarIso("2025-12-10 00:00:00")).toBe("2025-12-10");
    expect(excelDatumNaarIso("10/12/2025")).toBe("2025-12-10");
    expect(excelDatumNaarIso("")).toBe("");
    expect(excelDatumNaarIso(null)).toBe("");
  });
});
