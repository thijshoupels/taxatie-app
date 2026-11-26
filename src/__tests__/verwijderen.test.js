// Tests voor het verwijderen van een dossier (deleteDossier in data/dossiers.js en handleDelete in
// App.jsx). Aanleiding: verwijderde dossiers verdwenen niet meteen uit het overzicht. Twee
// oorzaken: (1) het dossier bleef staan tot alle bijlagen (vijf mappen, na elkaar opgevraagd) en de
// rij op de server weg waren; (2) wie snel na elkaar verwijderde, zette met een verouderde lijst het
// vorige dossier terug in het overzicht.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

vi.mock("../data/supabase.js", () => ({
  supabase: globalThis.__nepSupabase = {
    log: [], open: 0, maxOpen: 0, faalDelete: false,
    storage: {
      from: () => ({
        list: async (pad) => {
          const s = globalThis.__nepSupabase;
          s.open++; s.maxOpen = Math.max(s.maxOpen, s.open);
          await new Promise((r) => setTimeout(r, 5));
          s.open--; s.log.push(`list ${pad}`);
          return { data: pad.endsWith("/fotos") ? [{ id: "1", name: "a.jpg" }] : [], error: null };
        },
        remove: async (paden) => { globalThis.__nepSupabase.log.push(`remove ${paden.join(",")}`); return { error: null }; },
      }),
    },
    from: () => ({
      delete: () => ({
        eq: async (_k, id) => {
          const s = globalThis.__nepSupabase;
          s.log.push(`delete ${id}`);
          return s.faalDelete ? { error: { message: "geweigerd" } } : { error: null };
        },
      }),
    }),
  },
  haalSessieToken: async () => null,
}));
vi.mock("../data/lokaleOpslag.js", () => ({
  bewaarLokaalDossier: async () => Date.now(),
  haalLokaalDossier: async () => null,
  haalAlleLokaleDossiers: async () => [],
  haalWachtendeDossiers: async () => [],
  markeerGesynchroniseerd: async () => {},
  verwijderLokaalDossier: async () => {},
}));

import { deleteDossier } from "../data/dossiers.js";

// setIndex zoals React het doet: een functie krijgt de HUIDIGE lijst
const maakIndex = (start) => {
  const st = { lijst: start };
  st.setIndex = (v) => { st.lijst = typeof v === "function" ? v(st.lijst) : v; };
  return st;
};

describe("deleteDossier", () => {
  it("vraagt de bijlagenmappen tegelijk op, verwijdert de bijlagen en dan de rij", async () => {
    const s = globalThis.__nepSupabase; s.log = []; s.maxOpen = 0; s.faalDelete = false;
    const st = maakIndex([{ id: "a" }, { id: "b" }]);
    const res = await deleteDossier("a", st.lijst, st.setIndex);
    expect(res.ok).toBe(true);
    expect(s.maxOpen).toBe(5);
    expect(s.log.filter((l) => l.startsWith("list")).length).toBe(5);
    expect(s.log).toContain("remove a/fotos/a.jpg");
    expect(s.log.indexOf("remove a/fotos/a.jpg")).toBeLessThan(s.log.indexOf("delete a"));
    expect(st.lijst).toEqual([{ id: "b" }]);
  });

  it("twee dossiers snel na elkaar: het eerste komt niet terug in de lijst", async () => {
    const s = globalThis.__nepSupabase; s.faalDelete = false;
    const st = maakIndex([{ id: "a" }, { id: "b" }, { id: "c" }]);
    const begin = st.lijst; // beide klikken zien nog dezelfde (oude) lijst
    await Promise.all([deleteDossier("a", begin, st.setIndex), deleteDossier("b", begin, st.setIndex)]);
    expect(st.lijst).toEqual([{ id: "c" }]);
  });

  it("mislukt het verwijderen op de server, dan blijft het dossier in de lijst", async () => {
    const s = globalThis.__nepSupabase; s.faalDelete = true;
    const st = maakIndex([{ id: "a" }]);
    const res = await deleteDossier("a", st.lijst, st.setIndex);
    expect(res.ok).toBe(false);
    expect(st.lijst).toEqual([{ id: "a" }]);
    s.faalDelete = false;
  });
});

describe("overzicht", () => {
  const app = fs.readFileSync(path.join(process.cwd(), "src", "App.jsx"), "utf8");
  it("het dossier verdwijnt meteen en komt enkel terug als het verwijderen mislukt", () => {
    const h = app.slice(app.indexOf("const handleDelete = async"), app.indexOf("const handleDelen"));
    expect(h.indexOf("setVerwijderd((s) => new Set(s).add(id));")).toBeGreaterThan(-1);
    expect(h.indexOf("setVerwijderd((s) => new Set(s).add(id));")).toBeLessThan(h.indexOf("await deleteDossier("));
    expect(h).toMatch(/res\.ok === false\) \{\s*setVerwijderd\(\(s\) => \{ const n = new Set\(s\); n\.delete\(id\); return n; \}\);/);
    expect(app).toMatch(/<Dashboard user=\{session\} index=\{verwijderd\.size \? index\.filter\(\(x\) => !verwijderd\.has\(x\.id\)\) : index\}/);
  });
});
