// Tests voor de formatteer-/escape-helpers uit lib/format.js — voordien volledig ongetest
// (zie README.md, "Bekende grenzen": enkel de rekenmodule had tests). Deze helpers worden overal
// gebruikt in scherm én PDF-rapport (bedragen, percentages, datums, HTML-escaping), dus een
// stille regressie hier zou zich meteen in élk rapport tonen.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import {
  num, epcRichtwaardePct, eur, pct, nlDate, uid, dash, joinOrDash, unit, isEmptyVal, wEsc,
} from "../lib/format.js";

describe("num", () => {
  it("parseert een geldig getal (ook als string)", () => {
    expect(num("12.5")).toBe(12.5);
    expect(num(7)).toBe(7);
  });
  it("geeft 0 terug voor een lege, ontbrekende of ongeldige waarde", () => {
    expect(num("")).toBe(0);
    expect(num("abc")).toBe(0);
    expect(num(undefined)).toBe(0);
  });
});

describe("epcRichtwaardePct", () => {
  it("geeft de juiste richtwaarde per EPC-schijf", () => {
    expect(epcRichtwaardePct("50")).toBe(2);
    expect(epcRichtwaardePct("100")).toBe(2);
    expect(epcRichtwaardePct("150")).toBe(1);
    expect(epcRichtwaardePct("250")).toBe(0);
    expect(epcRichtwaardePct("350")).toBe(-2);
    expect(epcRichtwaardePct("500")).toBe(-4);
  });
  it("geeft 0 terug bij een ongeldige of ontbrekende EPC-waarde", () => {
    expect(epcRichtwaardePct("")).toBe(0);
    expect(epcRichtwaardePct("onbekend")).toBe(0);
  });
});

describe("eur", () => {
  it("formatteert als Belgisch euro-bedrag zonder decimalen", () => {
    // \s+ i.p.v. een letterlijke spatie: toLocaleString gebruikt hier een non-breaking space,
    // wat per Node-/ICU-versie kan verschillen — de test moet daar niet op struikelen.
    expect(eur(1234).replace(/\s+/g, " ")).toBe("€ 1.234");
    expect(eur(0).replace(/\s+/g, " ")).toBe("€ 0");
  });
});

describe("pct", () => {
  it("rondt af op 2 decimalen met een komma i.p.v. een punt", () => {
    expect(pct(12.3456)).toBe("12,35%");
  });
});

describe("nlDate", () => {
  it("zet een ISO-datum (JJJJ-MM-DD) om naar de Vlaamse notatie DD/MM/JJJJ", () => {
    expect(nlDate("2026-09-14")).toBe("14/09/2026");
  });
  it("laat een lege of niet-matchende waarde ongewijzigd", () => {
    expect(nlDate("")).toBe("");
    expect(nlDate("geen datum")).toBe("geen datum");
  });
});

describe("dash / joinOrDash / unit / isEmptyVal", () => {
  it("dash toont een streepje voor een lege, null- of undefined-waarde, anders de waarde zelf", () => {
    expect(dash("")).toBe("—");
    expect(dash(null)).toBe("—");
    expect(dash(undefined)).toBe("—");
    expect(dash("hallo")).toBe("hallo");
    expect(dash(0)).toBe(0);
  });
  it("joinOrDash voegt samen met ', ', of toont een streepje bij een lege/ontbrekende lijst", () => {
    expect(joinOrDash(["a", "b"])).toBe("a, b");
    expect(joinOrDash([])).toBe("—");
    expect(joinOrDash(undefined)).toBe("—");
  });
  it("unit voegt de eenheid toe, of toont een streepje bij een lege waarde", () => {
    expect(unit("10", "m²")).toBe("10 m²");
    expect(unit("", "m²")).toBe("—");
  });
  it("isEmptyVal herkent enkel de expliciete 'lege' varianten (ook het streepje zelf)", () => {
    expect(isEmptyVal("")).toBe(true);
    expect(isEmptyVal(null)).toBe(true);
    expect(isEmptyVal(undefined)).toBe(true);
    expect(isEmptyVal("—")).toBe(true);
    expect(isEmptyVal("0")).toBe(false);
    expect(isEmptyVal(0)).toBe(false);
    expect(isEmptyVal("tekst")).toBe(false);
  });
});

describe("wEsc", () => {
  it("escapet &, < en > (voor Word-veilige HTML-opbouw)", () => {
    expect(wEsc("Tom & Jerry <script>alert(1)</script>")).toBe(
      "Tom &amp; Jerry &lt;script&gt;alert(1)&lt;/script&gt;"
    );
  });
  it("laat aanhalingstekens ongemoeid", () => {
    expect(wEsc('"quoted"')).toBe('"quoted"');
  });
});

describe("uid", () => {
  it("geeft een niet-lege string terug", () => {
    expect(typeof uid()).toBe("string");
    expect(uid().length).toBeGreaterThan(0);
  });
});
