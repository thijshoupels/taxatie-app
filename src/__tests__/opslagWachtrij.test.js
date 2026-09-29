// Tests voor lib/opslagWachtrij.js: hooguit één opslagbeurt tegelijk, en enkel de recentste
// wachtende toestand vertrekt nog. Aanleiding: in de Supabase-logboeken (29/09/2026) liepen bij een
// dossier van 5,4 MB meerdere opslagbeurten tegelijk, blokkeerden ze elkaar in de databank en
// eindigden ze in een reeks 500-fouten.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { maakOpslagWachtrij } from "../lib/opslagWachtrij.js";

// een nep-opslagfunctie die we zelf laten "afronden", zodat de test de volgorde volledig bepaalt
function nepOpslag() {
  const log = { gestart: [], actief: 0, maxActief: 0, open: [] };
  const voerUit = (snapshot) => new Promise((resolve) => {
    log.gestart.push(snapshot);
    log.actief++;
    log.maxActief = Math.max(log.maxActief, log.actief);
    log.open.push(() => { log.actief--; resolve({ ok: true, bewaard: snapshot }); });
  });
  const rondEersteAf = async () => { log.open.shift()(); await wacht(); };
  return { log, voerUit, rondEersteAf };
}
const wacht = () => new Promise((r) => setTimeout(r, 0));

describe("maakOpslagWachtrij", () => {
  it("laat nooit twee opslagbeurten tegelijk lopen", async () => {
    const { log, voerUit, rondEersteAf } = nepOpslag();
    const bewaar = maakOpslagWachtrij(voerUit);
    bewaar("v1"); bewaar("v2"); bewaar("v3");
    await wacht();
    expect(log.actief).toBe(1);
    await rondEersteAf();
    await rondEersteAf();
    expect(log.maxActief).toBe(1);
  });

  it("verstuurt na de lopende beurt enkel de RECENTSTE wachtende toestand (tussenliggende vallen weg)", async () => {
    const { log, voerUit, rondEersteAf } = nepOpslag();
    const bewaar = maakOpslagWachtrij(voerUit);
    bewaar("v1"); bewaar("v2"); bewaar("v3"); bewaar("v4");
    await wacht();
    await rondEersteAf();
    await rondEersteAf();
    expect(log.gestart).toEqual(["v1", "v4"]);
  });

  it("geeft ingehaalde aanroepers het resultaat van de recentere beurt terug", async () => {
    const { voerUit, rondEersteAf } = nepOpslag();
    const bewaar = maakOpslagWachtrij(voerUit);
    const p1 = bewaar("v1"); const p2 = bewaar("v2"); const p3 = bewaar("v3");
    await wacht();
    await rondEersteAf();
    await rondEersteAf();
    expect((await p1).bewaard).toBe("v1");
    expect((await p2).bewaard).toBe("v3");
    expect((await p3).bewaard).toBe("v3");
  });

  it("meldt of er nog een recentere toestand klaarstaat", async () => {
    const { voerUit, rondEersteAf } = nepOpslag();
    const bewaar = maakOpslagWachtrij(voerUit);
    bewaar("v1");
    expect(bewaar.heeftWachtende()).toBe(false);
    bewaar("v2");
    expect(bewaar.heeftWachtende()).toBe(true);
    await wacht();
    await rondEersteAf();
    expect(bewaar.heeftWachtende()).toBe(false);
    await rondEersteAf();
  });

  it("start meteen wanneer er niets loopt, ook na een eerdere beurt", async () => {
    const { log, voerUit, rondEersteAf } = nepOpslag();
    const bewaar = maakOpslagWachtrij(voerUit);
    bewaar("v1"); await wacht(); await rondEersteAf();
    bewaar("v2"); await wacht();
    expect(log.gestart).toEqual(["v1", "v2"]);
    await rondEersteAf();
  });

  it("een mislukte (afgewezen) beurt blokkeert de wachtrij niet", async () => {
    let n = 0;
    const bewaar = maakOpslagWachtrij(async (s) => { n++; if (s === "v1") throw new Error("kapot"); return { ok: true, bewaard: s }; });
    const p1 = bewaar("v1").catch((e) => e.message);
    const p2 = bewaar("v2");
    expect(await p1).toBe("kapot");
    expect((await p2).bewaard).toBe("v2");
    expect(n).toBe(2);
  });

  it("een hangende beurt blokkeert niet eeuwig: na maxWachtMs mag de wachtende toch vertrekken", async () => {
    const gestart = [];
    const bewaar = maakOpslagWachtrij((s) => { gestart.push(s); return s === "v1" ? new Promise(() => {}) : Promise.resolve({ ok: true }); }, { maxWachtMs: 20 });
    bewaar("v1"); bewaar("v2");
    await new Promise((r) => setTimeout(r, 60));
    expect(gestart).toEqual(["v1", "v2"]);
  });
});
