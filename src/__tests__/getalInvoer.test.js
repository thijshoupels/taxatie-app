// Tests voor getallen met een decimale KOMMA (12,5 m²) — lib/format.js (normaliseerGetalInvoer,
// leesGetal, getalVoorInvoer, num) en ui/velden.jsx (GetalInput). Aanleiding: in de app kon je
// geen oppervlakte met een komma invullen; een <input type="number"> weigert of wist de komma.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { num, leesGetal, normaliseerGetalInvoer, getalVoorInvoer, epcRichtwaardePct } from "../lib/format.js";

const lees = (f) => fs.readFileSync(path.join(process.cwd(), "src", f), "utf8");

describe("normaliseerGetalInvoer — wat je typt → wat bewaard wordt", () => {
  it("maakt van een komma een punt", () => {
    expect(normaliseerGetalInvoer("12,5")).toBe("12.5");
    expect(normaliseerGetalInvoer("0,05")).toBe("0.05");
    expect(normaliseerGetalInvoer("-2,5")).toBe("-2.5");
  });
  it("laat een getal met een punt ongemoeid (zoals vroeger)", () => {
    expect(normaliseerGetalInvoer("12.5")).toBe("12.5");
    expect(normaliseerGetalInvoer("250")).toBe("250");
  });
  it("leest punten naast een komma, of meerdere punten, als duizendtallen", () => {
    expect(normaliseerGetalInvoer("1.250,5")).toBe("1250.5");
    expect(normaliseerGetalInvoer("250.000.000")).toBe("250000000");
    expect(normaliseerGetalInvoer("1 250,75")).toBe("1250.75");
  });
  it("houdt een half getypt getal bij", () => {
    expect(normaliseerGetalInvoer("12,")).toBe("12.");
    expect(normaliseerGetalInvoer("-")).toBe("-");
    expect(normaliseerGetalInvoer("")).toBe("");
  });
  it("negeert letters en een minteken dat niet vooraan staat", () => {
    expect(normaliseerGetalInvoer("12,5 m²")).toBe("12.5");
    expect(normaliseerGetalInvoer("12-5")).toBe("125");
  });
});

describe("leesGetal en num", () => {
  it("lezen een komma als decimaalteken", () => {
    expect(leesGetal("12,5")).toBe(12.5);
    expect(num("12,5")).toBe(12.5);
    expect(num("1.250,5")).toBe(1250.5);
    expect(num("-3,25")).toBe(-3.25);
    expect(num("12,5 m²")).toBe(12.5);
  });
  it("geven exact hetzelfde als vroeger zonder komma", () => {
    for (const v of ["12.5", "250", "0.05", "  7 ", "12abc", "1e3", "-4", "12."]) {
      expect(num(v)).toBe(parseFloat(v));
    }
    expect(num(42.5)).toBe(42.5);
    expect(num("")).toBe(0);
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num("abc")).toBe(0);
    expect(Number.isNaN(leesGetal(""))).toBe(true);
  });
  it("EPC-richtwaarde met een komma", () => {
    expect(epcRichtwaardePct("99,5")).toBe(2);
    expect(epcRichtwaardePct("350,7")).toBe(-2);
  });
});

describe("getalVoorInvoer — bewaarde waarde → getoond in het veld", () => {
  it("toont een komma", () => {
    expect(getalVoorInvoer("12.5")).toBe("12,5");
    expect(getalVoorInvoer(0.05)).toBe("0,05");
    expect(getalVoorInvoer("250")).toBe("250");
    expect(getalVoorInvoer("")).toBe("");
    expect(getalVoorInvoer(null)).toBe("");
  });
  it("heen en terug levert dezelfde bewaarde waarde op", () => {
    for (const v of ["12.5", "0.05", "-2.5", "250", "1250.75"]) {
      expect(normaliseerGetalInvoer(getalVoorInvoer(v))).toBe(v);
    }
  });
});

describe("getalvelden in de app", () => {
  const schermen = ["stappen", "schermen", "ui", "rapport"].flatMap((map) =>
    fs.readdirSync(path.join(process.cwd(), "src", map)).filter((f) => f.endsWith(".jsx")).map((f) => `${map}/${f}`));

  it("gebruiken nergens nog een kaal <input type=\"number\">", () => {
    const fout = schermen.filter((f) => /<input[^>]*type="number"/.test(lees(f)));
    expect(fout).toEqual([]);
  });

  it("TextInput type=\"number\" wordt een GetalInput (tekstveld met cijferklavier)", () => {
    const velden = lees("ui/velden.jsx");
    expect(velden).toContain('if (props.type === "number") return <GetalInput');
    expect(velden).toContain('type="text" inputMode="decimal"');
  });

  it("de tabellen voor ruimtes, grondschijven, zones, aanhorigheden en parkeerplaatsen gebruiken GetalInput", () => {
    expect((lees("stappen/StepAfmetingen.jsx").match(/<GetalInput/g) || []).length).toBe(4);
    expect((lees("stappen/ZonesPaneel.jsx").match(/<GetalInput/g) || []).length).toBe(3);
    expect((lees("stappen/StepWaardering.jsx").match(/<GetalInput/g) || []).length).toBe(3);
  });

  it("velden die negatief kunnen zijn, krijgen een klavier met minteken", () => {
    const w = lees("stappen/StepWaardering.jsx");
    expect(w).toMatch(/inputMode="text"[^>]*value=\{d\.energiecorrectiePct\}/);
    expect(w).toMatch(/inputMode="text"[^>]*value=\{d\.dcfHuurgroeiPct\}/);
  });
});
