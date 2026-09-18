// ----------------------------------------------------------------------------
// data/lokaleOpslag.js — offline-opslag van dossiers in de browser (IndexedDB)
// ----------------------------------------------------------------------------
// Wordt gebruikt door data/dossiers.js zodra er geen (werkende) verbinding met Supabase is: elk
// dossier (inclusief de ingesloten foto's/documenten als base64, zie StepFotos.jsx/StepDocumenten.jsx)
// wordt hier hard lokaal bewaard, zodat een makelaar zonder internet toch verder kan werken en niets
// verliest. IndexedDB i.p.v. localStorage: dossiers met veel foto's kunnen ver boven de ~5MB-limiet
// van localStorage uitkomen, en IndexedDB blokkeert de UI niet (async).
//
// Bewust GEEN nieuwe npm-afhankelijkheid (bv. "idb"): package.json mag niet gewijzigd worden, dus dit
// bestand gebruikt rechtstreeks de native browser-IndexedDB-API, in een klein aantal Promise-wrappers.
//
// Eén store, "dossiers", key = dossier.id (dezelfde crypto.randomUUID() als de "echte" dossier-id —
// zie nieuweDossierId() in dossiers.js), zodat lokaal en server-side altijd dezelfde identiteit
// hebben en een latere synchronisatie een eenvoudige upsert-by-id kan zijn (geen aparte
// "lokale id" / "server id"-mapping nodig).
const DB_NAAM = "taxatie-app-offline";
const DB_VERSIE = 1;
const STORE_DOSSIERS = "dossiers";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      // zeer oude/uitzonderlijke browser zonder IndexedDB-ondersteuning — laat de aanroeper (via de
      // .catch hieronder bij elke exportfunctie) normaal terugvallen op "geen lokale opslag
      // beschikbaar" i.p.v. de hele app te laten crashen.
      reject(new Error("IndexedDB niet beschikbaar in deze browser"));
      return;
    }
    const request = indexedDB.open(DB_NAAM, DB_VERSIE);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_DOSSIERS)) {
        // "wachtOpSync" als index: zo kan synchroniseerWachtendeDossiers() (zie dossiers.js) snel
        // enkel de nog-niet-gesynchroniseerde dossiers ophalen zonder alles te moeten doorlopen.
        const store = db.createObjectStore(STORE_DOSSIERS, { keyPath: "id" });
        store.createIndex("wachtOpSync", "wachtOpSync", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Kon lokale opslag niet openen"));
  });
  return dbPromise;
}

function alsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Lokale opslag-bewerking mislukt"));
  });
}

async function metStore(modus, werk) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DOSSIERS, modus);
    const store = tx.objectStore(STORE_DOSSIERS);
    let resultaat;
    Promise.resolve(werk(store))
      .then((r) => { resultaat = r; })
      .catch(reject);
    tx.oncomplete = () => resolve(resultaat);
    tx.onerror = () => reject(tx.error || new Error("Lokale opslag-transactie mislukt"));
    tx.onabort = () => reject(tx.error || new Error("Lokale opslag-transactie afgebroken"));
  });
}

// bewaart (of overschrijft) een dossier lokaal. wachtOpSync: true betekent "dit dossier heeft
// wijzigingen die nog niet naar Supabase weggeschreven zijn" — gezet bij elke offline-opslagpoging
// (zie saveDossier in dossiers.js), en op false gezet zodra synchroniseerWachtendeDossiers() het
// dossier succesvol naar de server heeft gekregen (zie markeerGesynchroniseerd hieronder).
export async function bewaarLokaalDossier(dossier, { wachtOpSync = true } = {}) {
  const lokaalBewaardOp = Date.now();
  const record = { id: dossier.id, dossier, wachtOpSync, lokaalBewaardOp };
  await metStore("readwrite", (store) => alsPromise(store.put(record)));
  // Het tijdstip wordt teruggegeven zodat de aanroeper (saveDossier in dossiers.js) deze
  // momentopname later kan meegeven aan markeerGesynchroniseerd(): enkel als er sindsdien niets
  // nieuwers lokaal bewaard is, mag de "nog te synchroniseren"-vlag weg. Anders zou een wijziging
  // die de gebruiker nog intypte terwijl de opslagbeurt liep, stilzwijgend als "al verzonden"
  // gemarkeerd worden en dus nooit op de server belanden.
  return lokaalBewaardOp;
}

export async function haalLokaalDossier(id) {
  const record = await metStore("readonly", (store) => alsPromise(store.get(id)));
  return record ? record.dossier : null;
}

// alle lokaal bewaarde dossiers — gebruikt om de dashboard-index aan te vullen met dossiers die
// (nog) niet op de server staan (nieuw aangemaakt terwijl offline) of waarvan de lokale versie
// nieuwer is dan wat de server liet zien bij de laatste succesvolle loadIndex().
export async function haalAlleLokaleDossiers() {
  const records = await metStore("readonly", (store) => alsPromise(store.getAll()));
  return records || [];
}

// enkel de dossiers die nog gesynchroniseerd moeten worden — gebruikt door
// synchroniseerWachtendeDossiers() (dossiers.js) zodat die niet elk lokaal dossier hoeft te
// herbekijken, ook niet dossiers die allang (lang geleden) succesvol gesynchroniseerd waren.
export async function haalWachtendeDossiers() {
  const alle = await haalAlleLokaleDossiers();
  return alle.filter((r) => r.wachtOpSync);
}

// "nietNieuwerDan" is het lokaalBewaardOp-tijdstip van de momentopname die effectief naar de server
// ging (zie bewaarLokaalDossier). Staat er intussen een nieuwer record — de gebruiker typte door
// terwijl de opslagbeurt liep — dan blijft de vlag staan, zodat die laatste wijziging alsnog
// verzonden wordt in plaats van verloren te gaan zodra het dossier opnieuw van de server komt.
// Zonder dit argument (of bij een ouder record) gedraagt de functie zich als voorheen.
export async function markeerGesynchroniseerd(id, nietNieuwerDan) {
  return metStore("readwrite", async (store) => {
    const record = await alsPromise(store.get(id));
    if (!record) return false;
    if (typeof nietNieuwerDan === "number" && record.lokaalBewaardOp > nietNieuwerDan) return false;
    record.wachtOpSync = false;
    await alsPromise(store.put(record));
    return true;
  });
}

// opgeruimd nadat een dossier succesvol verwijderd is (zie deleteDossier in dossiers.js) — voorkomt
// dat een verwijderd dossier via de lokale opslag na een volgende offline-periode weer "terugkomt".
export async function verwijderLokaalDossier(id) {
  return metStore("readwrite", (store) => alsPromise(store.delete(id)));
}
