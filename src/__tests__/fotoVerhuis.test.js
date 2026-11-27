// Tests voor "Foto's verhuizen" (data/fotoVerhuis.js, schermen/FotoVerhuis.jsx en
// supabase/foto-verhuis.sql): de foto's van een ouder dossier gaan uit de databank naar Storage,
// elke foto wordt nagekeken vóór ze uit de databank verdwijnt, "laatst bewerkt" blijft staan, en
// een dossier dat intussen gewijzigd werd of net bewerkt is, blijft ongemoeid.
//
// Supabase (databank én Storage) wordt nagebootst.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

vi.mock("../data/supabase.js", () => ({
  supabase: {
    from: (...a) => globalThis.__nep.from(...a),
    storage: { from: () => globalThis.__nep.storage },
  },
  haalSessieToken: async () => null,
}));

import { verhuisFotosVanDossier, maakFotoVerhuis, vatSamen, RECENT_MINUTEN } from "../data/fotoVerhuis.js";
import { bytesVanDataUrl, telFotosInDatabank, _vergeetFotoOpslag } from "../data/fotoOpslag.js";

const lees = (f) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const FOTO = (t) => "data:image/jpeg;base64," + btoa(t.repeat(40));
const OUD = "2026-10-01T09:00:00.000000+00:00";
const NU = new Date("2026-11-27T12:00:00Z").getTime();

function maakNep(rij, { sqlUitgevoerd = true } = {}) {
  const nep = { rij: rij ? JSON.parse(JSON.stringify(rij)) : null, bestanden: new Map(), uploads: [], writes: [], uploadFaalt: () => false, foutGrootte: new Set() };
  nep.from = () => {
    const q = { filters: {} };
    const b = {
      select(cols) { if (!q.op) q.op = "select"; q.cols = cols; return b; },
      update(p) { q.op = "update"; q.payload = p; return b; },
      eq(k, v) { q.filters[k] = v; return b; },
      maybeSingle() { return b; },
      then(ok, nok) {
        let res;
        if (q.op === "update") {
          if (!nep.rij || nep.rij.laatst_bewerkt !== q.filters.laatst_bewerkt) res = { data: [], error: null };
          else {
            nep.writes.push(JSON.parse(JSON.stringify(q.payload)));
            const media = { ...(q.payload.media || nep.rij.media) };
            // de trigger uit supabase/foto-verhuis.sql
            const verhuis = sqlUitgevoerd && "fotoVerhuis" in media;
            if (verhuis) delete media.fotoVerhuis;
            nep.rij = { ...nep.rij, ...q.payload, media, laatst_bewerkt: verhuis ? nep.rij.laatst_bewerkt : "2026-11-27T12:00:00.000000+00:00" };
            res = { data: [{ laatst_bewerkt: nep.rij.laatst_bewerkt }], error: null };
          }
        } else {
          res = { data: nep.rij && nep.rij.id === q.filters.id ? JSON.parse(JSON.stringify(nep.rij)) : null, error: null };
        }
        return Promise.resolve(res).then(ok, nok);
      },
    };
    return b;
  };
  nep.storage = {
    async upload(pad, blob) {
      if (nep.uploadFaalt(pad)) return { error: { message: "netwerkfout" } };
      nep.bestanden.set(pad, blob); nep.uploads.push(pad); return { error: null };
    },
    async list(map) {
      const uit = [...nep.bestanden.entries()].filter(([p]) => p.startsWith(map + "/"))
        .map(([p, blob]) => ({ name: p.slice(map.length + 1), metadata: { size: nep.foutGrootte.has(p) ? blob.size - 1 : blob.size } }));
      return { data: uit, error: null };
    },
    async remove() { return { error: null }; },
  };
  globalThis.__nep = nep;
  return nep;
}

const rij = (extra = {}) => ({
  id: "d1", laatst_bewerkt: OUD,
  media: {
    fotos: [{ id: "f1", categorie: "Voorgevel", base64: FOTO("a") }, { id: "f2", categorie: "Tuin", base64: FOTO("b") }],
    documenten: [{ id: "doc1", naam: "legger.pdf", pad: "d1/documenten/legger.pdf" }],
    voorpaginaFoto: { id: "v1", base64: FOTO("c") },
  },
  data: { notities: "tekst blijft", extraPanden: [] },
  ...extra,
});

beforeEach(() => { _vergeetFotoOpslag(); });

describe("één dossier verhuizen", () => {
  it("zet de foto's in Storage, controleert ze, en houdt enkel het pad over — laatst bewerkt blijft staan", async () => {
    const nep = maakNep(rij());
    const r = await verhuisFotosVanDossier("d1", { nu: NU });
    expect(r).toMatchObject({ status: "verhuisd", aantal: 3, nogInDatabank: 0, afgekeurd: 0, datumBleef: true });
    expect(nep.uploads.sort()).toEqual(["d1/fotos/f1.jpg", "d1/fotos/f2.jpg", "d1/fotos/voorblad-v1.jpg"]);
    const media = nep.rij.media;
    expect(media.fotos).toEqual([{ id: "f1", categorie: "Voorgevel", pad: "d1/fotos/f1.jpg" }, { id: "f2", categorie: "Tuin", pad: "d1/fotos/f2.jpg" }]);
    expect(media.voorpaginaFoto).toEqual({ id: "v1", pad: "d1/fotos/voorblad-v1.jpg" });
    expect(media.documenten).toEqual(rij().media.documenten); // documenten ongemoeid
    expect("fotoVerhuis" in media).toBe(false);
    expect(nep.rij.laatst_bewerkt).toBe(OUD);
    // enkel de kolom media werd geschreven, met het merkteken, en enkel als de versie nog klopt
    expect(nep.writes).toHaveLength(1);
    expect(Object.keys(nep.writes[0])).toEqual(["media"]);
    expect(nep.writes[0].media.fotoVerhuis).toBe(true);
    expect(nep.rij.data).toEqual(rij().data);
    // de bestanden in Storage zijn exact de foto's
    expect(nep.bestanden.get("d1/fotos/f1.jpg").size).toBe(bytesVanDataUrl(FOTO("a")));
  });

  it("een foto die niet volledig in Storage staat, blijft in de databank (tegenproef op de controle)", async () => {
    const nep = maakNep(rij());
    nep.foutGrootte.add("d1/fotos/f2.jpg");
    const r = await verhuisFotosVanDossier("d1", { nu: NU });
    expect(r).toMatchObject({ status: "verhuisd", aantal: 2, nogInDatabank: 1, afgekeurd: 1 });
    expect(nep.rij.media.fotos[1].base64).toBe(FOTO("b"));
    expect(nep.rij.media.fotos[0].pad).toBe("d1/fotos/f1.jpg");
  });

  it("lukt het opladen nergens, dan wordt er niets geschreven", async () => {
    const nep = maakNep(rij());
    nep.uploadFaalt = () => true;
    const r = await verhuisFotosVanDossier("d1", { nu: NU });
    expect(r.status).toBe("fout");
    expect(nep.writes).toHaveLength(0);
    expect(telFotosInDatabank({ id: "d1", ...nep.rij.media })).toBe(3);
  });

  it("een recent bewerkt dossier wordt overgeslagen, een al verhuisd dossier is in orde", async () => {
    let nep = maakNep(rij({ laatst_bewerkt: new Date(NU - (RECENT_MINUTEN - 1) * 60000).toISOString() }));
    expect((await verhuisFotosVanDossier("d1", { nu: NU })).status).toBe("overgeslagen");
    expect(nep.uploads).toHaveLength(0);
    nep = maakNep(rij());
    await verhuisFotosVanDossier("d1", { nu: NU });
    _vergeetFotoOpslag();
    const tweede = await verhuisFotosVanDossier("d1", { nu: NU });
    expect(tweede.status).toBe("in orde");
    expect(nep.writes).toHaveLength(1);
  });

  it("werd het dossier intussen gewijzigd, dan wordt er niets overschreven", async () => {
    const nep = maakNep(rij());
    const origineel = nep.from;
    // net vóór het wegschrijven bewaart iemand anders het dossier
    let eerste = true;
    nep.from = () => {
      const b = origineel();
      const update = b.update;
      b.update = (p) => { if (eerste) { eerste = false; nep.rij.laatst_bewerkt = "2026-11-27T11:59:00.000000+00:00"; } return update(p); };
      return b;
    };
    const r = await verhuisFotosVanDossier("d1", { nu: NU });
    expect(r.status).toBe("overgeslagen");
    expect(r.reden).toContain("intussen gewijzigd");
    expect(nep.rij.media.fotos[0].base64).toBe(FOTO("a"));
  });

  it("foto's van extra panden (in de kolom data) verhuizen mee", async () => {
    const nep = maakNep(rij({ media: { fotos: [], documenten: [], voorpaginaFoto: null }, data: { notities: "x", extraPanden: [{ pandId: "p2", fotos: [{ id: "e1", base64: FOTO("e") }] }] } }));
    const r = await verhuisFotosVanDossier("d1", { nu: NU });
    expect(r).toMatchObject({ status: "verhuisd", aantal: 1 });
    expect(nep.writes[0].data.extraPanden[0].fotos[0]).toEqual({ id: "e1", pad: "d1/fotos/e1.jpg" });
    expect(nep.writes[0].data.notities).toBe("x");
  });

  it("zonder de SQL-aanpassing merkt de verhuis dat laatst bewerkt naar vandaag sprong", async () => {
    maakNep(rij(), { sqlUitgevoerd: false });
    const r = await verhuisFotosVanDossier("d1", { nu: NU });
    expect(r).toMatchObject({ status: "verhuisd", datumBleef: false });
  });
});

describe("alle dossiers", () => {
  it("één voor één, met stoppen, en stopt meteen als laatst bewerkt toch verspringt", async () => {
    const volgorde = [];
    const verhuis = async (id) => { volgorde.push(id); return { id, status: id === "c" ? "fout" : "verhuisd", aantal: 2, bytes: 1048576, datumBleef: true }; };
    const updates = [];
    const loop = maakFotoVerhuis(["a", "b", "c"], { verhuis, opVoortgang: (v) => updates.push(v.klaar) });
    const uit = await loop.start();
    expect(volgorde).toEqual(["a", "b", "c"]);
    expect(updates).toEqual([1, 2, 3]);
    expect(vatSamen(uit.resultaten)).toMatchObject({ verhuisd: 2, fout: 1, fotos: 6, mb: 3, zonderSql: false });

    const gestopt = maakFotoVerhuis(["a", "b", "c"], { verhuis: async (id) => { if (id === "a") gestopt.stop(); return { id, status: "in orde" }; } });
    expect((await gestopt.start()).resultaten).toHaveLength(1);

    const zonderSql = maakFotoVerhuis(["a", "b"], { verhuis: async (id) => ({ id, status: "verhuisd", aantal: 1, datumBleef: false }) });
    const r = await zonderSql.start();
    expect(r.resultaten).toHaveLength(1);
    expect(r.gestopt).toBe(true);
    expect(vatSamen(r.resultaten).zonderSql).toBe(true);
  });
});

describe("SQL, laden en scherm", () => {
  it("de trigger laat laatst bewerkt enkel bij een verhuis staan en wist het merkteken", () => {
    for (const f of ["supabase/foto-verhuis.sql", "supabase/schema.sql"]) {
      const sql = lees(f);
      expect(sql).toContain("new.media ? 'fotoVerhuis'");
      expect(sql).toContain("new.media = new.media - 'fotoVerhuis';");
      expect(sql).toContain("new.laatst_bewerkt = old.laatst_bewerkt;");
      expect(sql).toContain("new.laatst_bewerkt = now();");
    }
  });
  it("het merkteken komt nooit in een geopend dossier", () => {
    const dossiers = lees("src/data/dossiers.js");
    expect(dossiers).toContain("const { fotoVerhuis: _merkteken, ...mediaVelden } = data.media || {};");
    expect(dossiers).toContain("...mediaVelden,");
  });
  it("enkel beheerders zien de knop, en alle dossiers kan pas na een nagekeken proefloop", () => {
    const dash = lees("src/schermen/Dashboard.jsx");
    expect(dash).toMatch(/\{\(user\.isAdmin \|\| user\.isPlatformBeheerder\) && \(\s*<button onClick=\{\(\) => setFotoVerhuisOpen\(true\)\}/);
    const scherm = lees("src/schermen/FotoVerhuis.jsx");
    expect(scherm).toContain("<button type=\"button\" onClick={doeAlles} disabled={!nagekeken}");
  });
});
