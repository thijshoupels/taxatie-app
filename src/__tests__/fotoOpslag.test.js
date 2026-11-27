// Tests voor de foto's in Supabase Storage (data/fotoOpslag.js, saveDossier/loadDossier in
// data/dossiers.js): in de databank komt enkel nog het pad, bij het openen komen de foto's terug
// als base64 — en er gaat nooit een foto verloren (opladen mislukt → base64 blijft bewaard).
//
// Supabase (databank én Storage) en de lokale opslag worden nagebootst.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../data/supabase.js", () => ({
  supabase: {
    from: (...a) => globalThis.__nep.from(...a),
    storage: { from: () => globalThis.__nep.storage },
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

import { loadDossier, saveDossier } from "../data/dossiers.js";
import { vingerafdruk, zonderOpgeladenFotos, _vergeetFotoOpslag } from "../data/fotoOpslag.js";

const FOTO_A = "data:image/jpeg;base64," + btoa("foto-a-inhoud".repeat(50));
const FOTO_B = "data:image/jpeg;base64," + btoa("foto-b-inhoud".repeat(50));
const FOTO_B2 = "data:image/jpeg;base64," + btoa("foto-b-bijgesneden".repeat(50));

function maakNep(rij) {
  let klok = 0;
  const nu = () => `2026-11-26T10:00:${String(++klok).padStart(2, "0")}.000000+00:00`;
  const nep = { rij: rij ? { ...rij } : null, bestanden: new Map(), uploads: [], verwijderd: [], uploadFaalt: false, writes: [] };
  const voerUit = (q) => {
    if (q.op === "update") {
      if (!nep.rij || nep.rij.laatst_bewerkt !== q.filters.laatst_bewerkt) return { data: [], error: null };
      nep.rij = { ...nep.rij, ...q.payload, laatst_bewerkt: nu() };
      nep.writes.push(q.payload);
      return { data: [{ laatst_bewerkt: nep.rij.laatst_bewerkt }], error: null };
    }
    if (q.op === "upsert") {
      nep.rij = { ...(nep.rij || {}), ...q.payload, laatst_bewerkt: nu() };
      nep.writes.push(q.payload);
      return { data: null, error: null };
    }
    if (!nep.rij || nep.rij.id !== q.filters.id) return { data: null, error: null };
    if (q.cols === "*") return { data: JSON.parse(JSON.stringify(nep.rij)), error: null };
    return { data: { laatst_bewerkt: nep.rij.laatst_bewerkt, opslagToken: nep.rij.data?.opslagToken ?? null }, error: null };
  };
  nep.from = () => {
    const q = { op: null, filters: {} };
    const b = {
      select(cols) { if (!q.op) q.op = "select"; q.cols = cols; return b; },
      update(p) { q.op = "update"; q.payload = p; return b; },
      upsert(p) { q.op = "upsert"; q.payload = p; return b; },
      eq(k, v) { q.filters[k] = v; return b; },
      maybeSingle() { return b; },
      then(ok, nok) { return Promise.resolve(voerUit(q)).then(ok, nok); },
    };
    return b;
  };
  nep.storage = {
    async upload(pad, blob) {
      // Storage eist dat het dossier al bestaat in de databank (toegangsregel)
      if (nep.uploadFaalt || !nep.rij || !pad.startsWith(`${nep.rij.id}/`)) return { error: { message: "new row violates row-level security policy" } };
      nep.bestanden.set(pad, blob);
      nep.uploads.push(pad);
      return { error: null };
    },
    async download(pad) {
      const b = nep.bestanden.get(pad);
      return b ? { data: b, error: null } : { data: null, error: { message: "Object not found" } };
    },
    async remove(paden) { paden.forEach((p) => { nep.bestanden.delete(p); nep.verwijderd.push(p); }); return { error: null }; },
  };
  globalThis.__nep = nep;
  return nep;
}

const basisRij = (id, media, data = {}) => ({
  id, owner_id: "makelaar-1", straat: "Kerkstraat", nummer: "5", bus: "", postcode: "9120", gemeente: "Beveren",
  status: "concept", aangemaakt_op: "2026-09-01T08:00:00+00:00", laatst_bewerkt: "2026-11-26T09:00:00.000000+00:00",
  data: { notities: "", opslagToken: "oude-sessie:1", extraPanden: [], ...data }, media,
});
const nieuwDossier = (id, extra = {}) => ({
  id, ownerId: "makelaar-1", straat: "Veldweg", nummer: "", bus: "", postcode: "9140", gemeente: "Temse", status: "concept",
  aangemaaktOp: "2026-11-26T08:00:00+00:00", fotos: [], documenten: [], voorpaginaFoto: null, extraPanden: [], ...extra,
});
const fotosInDb = (nep) => [...(nep.rij.media?.fotos || []), ...(nep.rij.media?.voorpaginaFoto ? [nep.rij.media.voorpaginaFoto] : [])];

beforeEach(() => {
  _vergeetFotoOpslag();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("nieuw dossier met foto's", () => {
  it("eerst de rij, dan de foto's naar Storage, dan de rij opnieuw — zonder base64", async () => {
    const nep = maakNep(null);
    const d = nieuwDossier("d-nieuw", {
      fotos: [{ id: "f1", naam: "voorgevel.jpg", url: "blob:x", base64: FOTO_A, categorie: "Voorgevel" }],
      voorpaginaFoto: { id: "v1", naam: "voor.jpg", base64: FOTO_B },
    });
    const res = await saveDossier(d, [], () => {});
    expect(res.ok).toBe(true);
    expect(nep.uploads.sort()).toEqual(["d-nieuw/fotos/f1.jpg", "d-nieuw/fotos/voorblad-v1.jpg"]);
    expect(nep.writes.length).toBe(2);
    // eerste schrijfbeurt: base64 als vangnet (de rij bestond nog niet), tweede: enkel paden
    expect(nep.writes[0].media.fotos[0].base64).toBe(FOTO_A);
    for (const f of fotosInDb(nep)) { expect(f.base64).toBeUndefined(); expect(f.url).toBeUndefined(); }
    expect(nep.rij.media.fotos[0]).toEqual({ id: "f1", naam: "voorgevel.jpg", categorie: "Voorgevel", pad: "d-nieuw/fotos/f1.jpg" });
    expect(nep.rij.media.voorpaginaFoto.pad).toBe("d-nieuw/fotos/voorblad-v1.jpg");
  });
});

describe("bestaand dossier", () => {
  it("oude dossiers met base64 in de databank: openen werkt, bij opslaan verhuizen de foto's", async () => {
    const nep = maakNep(basisRij("d-oud", { fotos: [{ id: "f1", naam: "a.jpg", base64: FOTO_A }], documenten: [], voorpaginaFoto: null }));
    const d = await loadDossier("d-oud");
    expect(d.fotos[0].base64).toBe(FOTO_A);
    expect((await saveDossier(d, [], () => {})).ok).toBe(true);
    expect(nep.uploads).toEqual(["d-oud/fotos/f1.jpg"]);
    expect(nep.writes.length).toBe(1); // de rij bestond al: eerst opladen, dan één schrijfbeurt
    expect(nep.rij.media.fotos[0]).toEqual({ id: "f1", naam: "a.jpg", pad: "d-oud/fotos/f1.jpg" });
  });

  it("bij het openen komen de foto's uit Storage terug als base64, en worden ze niet opnieuw opgeladen", async () => {
    const nep = maakNep(basisRij("d-pad", { fotos: [{ id: "f1", naam: "a.jpg", pad: "d-pad/fotos/f1.jpg" }], documenten: [], voorpaginaFoto: null }));
    nep.bestanden.set("d-pad/fotos/f1.jpg", new Blob([Uint8Array.from(atob(FOTO_A.split(",")[1]), (c) => c.charCodeAt(0))], { type: "image/jpeg" }));
    const d = await loadDossier("d-pad");
    expect(d.fotos[0].base64).toBe(FOTO_A);
    expect(d.fotos[0].pad).toBe("d-pad/fotos/f1.jpg");
    expect((await saveDossier({ ...d, notities: "x" }, [], () => {})).ok).toBe(true);
    expect(nep.uploads).toEqual([]);
    expect(nep.rij.media.fotos[0].base64).toBeUndefined();
  });

  it("een gewijzigde foto (bv. bijgesneden) wordt opnieuw opgeladen", async () => {
    const nep = maakNep(basisRij("d-wijzig", { fotos: [{ id: "f1", naam: "b.jpg", base64: FOTO_B }], documenten: [], voorpaginaFoto: null }));
    const d = await loadDossier("d-wijzig");
    await saveDossier(d, [], () => {});
    await saveDossier({ ...d, fotos: [{ ...d.fotos[0], base64: FOTO_B2 }] }, [], () => {});
    expect(nep.uploads).toEqual(["d-wijzig/fotos/f1.jpg", "d-wijzig/fotos/f1.jpg"]);
    expect(await nep.bestanden.get("d-wijzig/fotos/f1.jpg").text()).toBe(atob(FOTO_B2.split(",")[1]));
  });

  it("opladen mislukt: de foto blijft als base64 in de databank (er gaat niets verloren)", async () => {
    const nep = maakNep(basisRij("d-faal", { fotos: [], documenten: [], voorpaginaFoto: null }));
    const d = await loadDossier("d-faal");
    nep.uploadFaalt = true;
    expect((await saveDossier({ ...d, fotos: [{ id: "f9", naam: "c.jpg", base64: FOTO_A }] }, [], () => {})).ok).toBe(true);
    expect(nep.rij.media.fotos[0].base64).toBe(FOTO_A);
    expect(nep.rij.media.fotos[0].pad).toBeUndefined();
  });

  it("een verwijderde foto verdwijnt ook uit Storage; foto's van een collega blijven staan", async () => {
    const nep = maakNep(basisRij("d-weg", { fotos: [{ id: "f1", naam: "a.jpg", base64: FOTO_A }, { id: "f2", naam: "b.jpg", base64: FOTO_B }], documenten: [], voorpaginaFoto: null }));
    nep.bestanden.set("d-weg/fotos/collega.jpg", new Blob(["x"]));
    const d = await loadDossier("d-weg");
    await saveDossier(d, [], () => {});
    await saveDossier({ ...d, fotos: [d.fotos[0]] }, [], () => {});
    await new Promise((r) => setTimeout(r, 0));
    expect(nep.verwijderd).toEqual(["d-weg/fotos/f2.jpg"]);
    expect(nep.bestanden.has("d-weg/fotos/collega.jpg")).toBe(true);
    expect(nep.rij.media.fotos.map((f) => f.id)).toEqual(["f1"]);
  });

  it("foto's van extra panden (in de gewone dossiergegevens) verhuizen ook", async () => {
    const nep = maakNep(basisRij("d-panden", { fotos: [], documenten: [], voorpaginaFoto: null },
      { extraPanden: [{ id: "p2", fotos: [{ id: "pf1", naam: "garage.jpg", base64: FOTO_A }] }] }));
    const d = await loadDossier("d-panden");
    expect((await saveDossier(d, [], () => {})).ok).toBe(true);
    expect(nep.uploads).toEqual(["d-panden/fotos/pf1.jpg"]);
    expect(nep.rij.data.extraPanden[0].fotos[0]).toEqual({ id: "pf1", naam: "garage.jpg", pad: "d-panden/fotos/pf1.jpg" });
    const terug = await loadDossier("d-panden");
    expect(terug.extraPanden[0].fotos[0].base64).toBe(FOTO_A);
  });

  it("een foto die niet meer in Storage staat: pad blijft bewaard, geen eindeloze laadcirkel", async () => {
    maakNep(basisRij("d-kwijt", { fotos: [{ id: "f1", naam: "a.jpg", pad: "d-kwijt/fotos/f1.jpg" }], documenten: [], voorpaginaFoto: null }));
    const d = await loadDossier("d-kwijt");
    expect(d.fotos[0]).toMatchObject({ pad: "d-kwijt/fotos/f1.jpg", base64: "", nietGevonden: true });
  });
});

describe("hulpfuncties", () => {
  it("vingerafdruk onderscheidt verschillende foto's en is stabiel", () => {
    expect(vingerafdruk(FOTO_A)).toBe(vingerafdruk(FOTO_A));
    expect(vingerafdruk(FOTO_A)).not.toBe(vingerafdruk(FOTO_B));
  });
  it("zonder opgeladen foto's: enkel opgeladen foto's verliezen hun base64; blob-urls nooit mee", () => {
    const uit = zonderOpgeladenFotos(nieuwDossier("d-x", { fotos: [{ id: "f1", url: "blob:y", base64: FOTO_A }] }));
    expect(uit.fotos[0]).toEqual({ id: "f1", base64: FOTO_A });
  });
});
