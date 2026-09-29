// Tests voor de botsingscontrole bij het opslaan (data/dossiers.js): de melding "intussen elders
// gewijzigd" mag enkel verschijnen wanneer iemand ANDERS het dossier wijzigde — niet wanneer de
// "andere" versie in de databank gewoon van een eerdere opslagbeurt van onszelf komt. Aanleiding
// (logboeken 29/09/2026): een opslagbeurt lukte op de server, maar het antwoord ging onderweg
// verloren (500/502/520); daarna gaf elke volgende opslag ten onrechte die botsingsmelding.
//
// Supabase en de lokale (IndexedDB-)opslag worden hier vervangen door een kleine nep-databank met
// één dossierrij, die de voorwaardelijke UPDATE (op laatst_bewerkt) net als Postgres uitvoert.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../data/supabase.js", () => ({
  supabase: { from: (...a) => globalThis.__nepDb.from(...a) },
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

import { loadDossier, saveDossier, isEigenOpslagToken } from "../data/dossiers.js";

// ---------- nep-databank ----------
function maakNepDb(rij) {
  let klok = 0;
  const nu = () => `2026-09-29T10:00:${String(++klok).padStart(2, "0")}.000000+00:00`;
  const db = { rij: { ...rij }, verliesVolgendAntwoord: false, tokenLezenFaalt: false, updates: 0 };
  const voerUit = (q) => {
    if (q.op === "update") {
      db.updates++;
      const past = db.rij && db.rij.id === q.filters.id && db.rij.laatst_bewerkt === q.filters.laatst_bewerkt;
      if (!past) return { data: [], error: null };
      db.rij = { ...db.rij, ...q.payload, laatst_bewerkt: nu() };
      if (db.verliesVolgendAntwoord) {
        // de UPDATE is wél uitgevoerd, maar de browser krijgt enkel een serverfout te zien
        db.verliesVolgendAntwoord = false;
        return { data: null, error: { message: "Internal Server Error" } };
      }
      return { data: [{ laatst_bewerkt: db.rij.laatst_bewerkt }], error: null };
    }
    if (q.op === "upsert") {
      db.rij = { ...(db.rij || {}), ...q.payload, laatst_bewerkt: nu() };
      return { data: null, error: null };
    }
    // select
    if (!db.rij || db.rij.id !== q.filters.id) return { data: null, error: null };
    if (q.cols === "*") return { data: { ...db.rij }, error: null };
    const uit = { laatst_bewerkt: db.rij.laatst_bewerkt };
    if (q.cols.includes("opslagToken:data->>opslagToken")) {
      if (db.tokenLezenFaalt) return { data: null, error: { message: "failed to parse select parameter" } };
      uit.opslagToken = db.rij.data?.opslagToken ?? null;
    }
    return { data: uit, error: null };
  };
  db.from = () => {
    const q = { op: null, filters: {} };
    const b = {
      select(cols) { if (!q.op) q.op = "select"; q.cols = cols; return b; },
      update(p) { q.op = "update"; q.payload = p; return b; },
      upsert(p) { q.op = "upsert"; q.payload = p; return b; },
      eq(k, v) { q.filters[k] = v; return b; },
      in() { return b; },
      order() { return b; },
      maybeSingle() { return b; },
      then(ok, nok) { return Promise.resolve(voerUit(q)).then(ok, nok); },
    };
    return b;
  };
  return db;
}

let tel = 0;
function nieuwDossierInDb() {
  const id = `dossier-${++tel}`;
  const db = maakNepDb({
    id, owner_id: "makelaar-1", straat: "Kerkstraat", nummer: "5", bus: "", postcode: "9120", gemeente: "Beveren",
    status: "concept", aangemaakt_op: "2026-09-01T08:00:00+00:00", laatst_bewerkt: "2026-09-28T12:00:00.000000+00:00",
    data: { notities: "begin", opslagToken: "oude-sessie:3" }, media: { fotos: [], documenten: [], voorpaginaFoto: null },
  });
  globalThis.__nepDb = db;
  return { id, db };
}
const bewaar = (dossier, wijziging) => saveDossier({ ...dossier, ...wijziging }, [], () => {});

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("botsingscontrole bij het opslaan", () => {
  it("gewoon na elkaar opslaan werkt, zonder botsingsmelding", async () => {
    const { id, db } = nieuwDossierInDb();
    const dossier = await loadDossier(id);
    expect((await bewaar(dossier, { notities: "een" })).ok).toBe(true);
    expect((await bewaar(dossier, { notities: "twee" })).ok).toBe(true);
    expect(db.rij.data.notities).toBe("twee");
  });

  it("GEEN valse botsing wanneer een eerdere eigen opslag lukte maar het antwoord verloren ging", async () => {
    const { id, db } = nieuwDossierInDb();
    const dossier = await loadDossier(id);
    db.verliesVolgendAntwoord = true;
    const eerste = await bewaar(dossier, { notities: "een" });
    expect(eerste.ok).toBe(false); // de gebruiker zag een serverfout...
    expect(db.rij.data.notities).toBe("een"); // ...maar de databank had het wél
    const tweede = await bewaar(dossier, { notities: "twee" });
    expect(tweede.conflict).toBeFalsy();
    expect(tweede.ok).toBe(true);
    expect(db.rij.data.notities).toBe("twee");
  });

  it("blijft na zo'n verloren antwoord ook bij de volgende opslagbeurten gewoon werken", async () => {
    const { id, db } = nieuwDossierInDb();
    const dossier = await loadDossier(id);
    db.verliesVolgendAntwoord = true;
    await bewaar(dossier, { notities: "een" });
    await bewaar(dossier, { notities: "twee" });
    expect((await bewaar(dossier, { notities: "drie" })).ok).toBe(true);
    expect(db.rij.data.notities).toBe("drie");
  });

  it("meldt WEL een botsing wanneer een collega het dossier intussen wijzigde — en overschrijft diens werk niet", async () => {
    const { id, db } = nieuwDossierInDb();
    const dossier = await loadDossier(id);
    expect((await bewaar(dossier, { notities: "mijn versie" })).ok).toBe(true);
    // een collega (andere browsersessie) slaat op
    db.rij = { ...db.rij, data: { ...db.rij.data, notities: "versie collega", opslagToken: "sessie-collega:7" }, laatst_bewerkt: "2026-09-29T11:11:11.000000+00:00" };
    const r = await bewaar(dossier, { notities: "nog een wijziging van mij" });
    expect(r.ok).toBe(false);
    expect(r.conflict).toBe(true);
    expect(db.rij.data.notities).toBe("versie collega");
  });

  it("meldt een botsing (en overschrijft niets) wanneer het token niet uitgelezen kan worden", async () => {
    const { id, db } = nieuwDossierInDb();
    const dossier = await loadDossier(id);
    db.rij = { ...db.rij, data: { ...db.rij.data, notities: "versie collega" }, laatst_bewerkt: "2026-09-29T11:11:11.000000+00:00" };
    db.tokenLezenFaalt = true;
    const r = await bewaar(dossier, { notities: "van mij" });
    expect(r.conflict).toBe(true);
    expect(db.rij.data.notities).toBe("versie collega");
  });

  it("probeert na het herkennen van een eigen versie hooguit één keer opnieuw", async () => {
    const { id, db } = nieuwDossierInDb();
    const dossier = await loadDossier(id);
    db.verliesVolgendAntwoord = true;
    await bewaar(dossier, { notities: "een" });
    const voor = db.updates;
    await bewaar(dossier, { notities: "twee" });
    expect(db.updates - voor).toBe(2); // eerste poging (0 rijen) + één herhaling
  });
});

describe("isEigenOpslagToken", () => {
  it("herkent enkel tokens van de eigen sessie", () => {
    expect(isEigenOpslagToken("abc:1", "abc")).toBe(true);
    expect(isEigenOpslagToken("abc:12", "abc")).toBe(true);
    expect(isEigenOpslagToken("abcd:1", "abc")).toBe(false);
    expect(isEigenOpslagToken("xyz:1", "abc")).toBe(false);
  });
  it("is veilig bij ontbrekende waarden", () => {
    expect(isEigenOpslagToken(null, "abc")).toBe(false);
    expect(isEigenOpslagToken(undefined, "abc")).toBe(false);
    expect(isEigenOpslagToken("abc:1", "")).toBe(false);
  });
});
