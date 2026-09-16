// ----------------------------------------------------------------------------
// data/dossiers.js — CRUD op de "dossiers"-tabel (laden, opslaan, verwijderen, logboek)
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 4) zonder wijziging aan de logica
// zelf. Enkel de zes functies die elders in App.jsx (DossierWizard/AppRoot) rechtstreeks
// aangeroepen worden zijn "export": nieuweDossierId, loadIndex, loadDossier, saveDossier,
// deleteDossier, logDossierEvent. De interne helpers (eenvoudigeHash, de media-/versie-caches,
// bouwIndexMeta, verwijderDossierBestanden, _saveDossierPoging) blijven module-privé, precies
// zoals ze voorheen enkel binnen dit deel van App.jsx zichtbaar waren.
import { supabase } from "./supabase.js";
import { uid } from "../lib/format.js";
import { isNetwerkFout } from "../lib/online.js";
import {
  bewaarLokaalDossier, haalLokaalDossier, haalAlleLokaleDossiers, haalWachtendeDossiers, markeerGesynchroniseerd,
} from "./lokaleOpslag.js";

// ---------- persistente opslag (Supabase, gedeeld tussen makelaars, elk dossier gekoppeld aan een ownerId) ----------
// vervangt het vroegere window.storage (dat enkel binnen Claude.ai werkte) 1-op-1 door
// echte databaseaanroepen — zie /supabase/schema.sql voor de tabellen en toegangsregels.

// een geldige uuid nodig voor id's die in de database terechtkomen (dossiers.id); de korte
// uid() hieronder blijft gebruikt voor interne rij-id's binnen een dossier (kamers, eigenaars, ...)
// die nooit als een eigen databasekolom bestaan.
export const nieuweDossierId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : uid();

// Voegt lokaal (nog niet gesynchroniseerd) bewaarde dossiers toe aan het van de server opgehaalde
// dossieroverzicht: een offline aangemaakt dossier staat nog nergens op de server (komt er dus
// gewoon bij) en een offline bewerkt dossier toont voorlopig zijn lokale (nieuwere) gegevens i.p.v.
// de nog niet-bijgewerkte serverversie — tot de synchronisatie (zie synchroniseerWachtendeDossiers
// hieronder) is voltooid. Pure functie (geen netwerk/opslag zelf) — apart uitgeschreven zodat dit
// zonder browser-omgeving (IndexedDB, Supabase) getest kan worden.
export function voegLokaleDossiersToeAanIndex(serverIndex, lokaleDossiers) {
  const wachtend = (lokaleDossiers || []).filter((r) => r.wachtOpSync);
  if (!wachtend.length) return serverIndex;
  const perId = new Map((serverIndex || []).map((x) => [x.id, x]));
  for (const record of wachtend) {
    const bestaand = perId.get(record.dossier.id);
    const laatstBewerkt = bestaand?.laatstBewerkt || new Date(record.lokaalBewaardOp || Date.now()).toISOString();
    perId.set(record.dossier.id, bouwIndexMeta(record.dossier, laatstBewerkt));
  }
  return [...perId.values()].sort((a, b) => new Date(b.laatstBewerkt) - new Date(a.laatstBewerkt));
}

export async function loadIndex() {
  // "kantoren(naam)" haalt in dezelfde opvraging meteen de kantoornaam op (via de foreign key
  // dossiers.kantoor_id -> kantoren.id) — nodig zodat het Dashboard, voor de platform-beheerder
  // (die dossiers van meerdere kantoren door elkaar te zien krijgt), die eerst per kantoor kan
  // groeperen. De toegangsregel op "kantoren" (zie supabase/schema.sql) staat dit voor elke rij
  // hier toe: het eigen kantoor van de opvrager, of elk kantoor voor een (kantoor-/platform-)
  // beheerder — precies dezelfde kantoren die via de dossiers-rijregel al meekomen.
  let serverIndex = null;
  try {
    const { data, error } = await supabase
      .from("dossiers")
      .select("id, owner_id, straat, nummer, bus, postcode, gemeente, status, aangemaakt_op, laatst_bewerkt, kantoor_id, kantoren(naam)")
      .order("laatst_bewerkt", { ascending: false });
    if (error) {
      if (!isNetwerkFout(error)) { console.error(error); return []; }
      // netwerkfout: hieronder valt de code terug op enkel de lokaal bewaarde dossiers
    } else {
      // voor een beheerder geeft de rijregel hierboven (RLS, zie supabase/schema.sql) de dossiers van
      // ALLE makelaars terug i.p.v. enkel de eigen — haal dan ook meteen ieders naam op, zodat het
      // Dashboard in de beheerder-weergave kan tonen van wie elk dossier is. Voor een gewone makelaar
      // bevat "data" hierboven toch al enkel de eigen dossiers (RLS), dus deze query blijft licht.
      const ownerIds = [...new Set(data.map((x) => x.owner_id))];
      let namenPerId = {};
      if (ownerIds.length) {
        const { data: profielen } = await supabase.from("profielen").select("id, naam").in("id", ownerIds);
        namenPerId = Object.fromEntries((profielen || []).map((p) => [p.id, p.naam]));
      }
      // veldnamen omzetten naar wat de React-componenten al verwachten (camelCase)
      serverIndex = data.map((x) => ({
        id: x.id, ownerId: x.owner_id, makelaarNaam: namenPerId[x.owner_id] || "",
        straat: x.straat, nummer: x.nummer, bus: x.bus,
        postcode: x.postcode, gemeente: x.gemeente, status: x.status,
        aangemaaktOp: x.aangemaakt_op, laatstBewerkt: x.laatst_bewerkt,
        kantoorId: x.kantoor_id, kantoorNaam: x.kantoren?.naam || "",
      }));
    }
  } catch (e) {
    if (!isNetwerkFout(e)) { console.error(e); return []; }
    // netwerkfout (bv. supabase-js gooide zelf een fout i.p.v. { error } terug te geven) — zelfde
    // terugval als hierboven
  }
  // altijd (ook wanneer de server bereikbaar was) de lokaal wachtende dossiers erbij nemen: zo
  // blijft een nog niet-gesynchroniseerd, offline aangemaakt of bewerkt dossier zichtbaar in het
  // dashboard, ook meteen nadat de verbinding terugkomt maar vóór de synchronisatie voltooid is.
  const lokaleDossiers = await haalAlleLokaleDossiers().catch((e) => { console.error("Kon lokale dossiers niet ophalen:", e.message); return []; });
  if (serverIndex === null) {
    // "volledig geen signaal": enkel de lokale dossiers, zonder makelaarNaam/kantoorNaam (die
    // vraagt de app anders via een aparte tabel op — hier niet beschikbaar zonder netwerk; leeg
    // blijft veiliger dan een verkeerde naam tonen).
    return lokaleDossiers.map((r) => bouwIndexMeta(r.dossier, new Date(r.lokaalBewaardOp || Date.now()).toISOString()));
  }
  return voegLokaleDossiersToeAanIndex(serverIndex, lokaleDossiers);
}

export async function loadDossier(id) {
  try {
    const { data, error } = await supabase.from("dossiers").select("*").eq("id", id).single();
    if (error) {
      if (!isNetwerkFout(error)) { console.error(error); return null; }
      // netwerkfout: hieronder valt de code terug op de lokaal bewaarde kopie
      return await haalLokaalDossier(id);
    }
    // versie onthouden voor de botsingscontrole bij het opslaan (zie _saveDossierPoging)
    onthoudVerwachteVersie(id, data.laatst_bewerkt);
    // "data.data" bevat de volledige dossier-JSON (alle overige velden) — dat komt overeen
    // met wat het vroegere dossier_<id>-object in window.storage was
    // straat/nummer/bus/postcode/gemeente/aangemaakt_op staan als aparte kolommen in de tabel
    // (niet in de JSON-blob, want saveDossier haalt ze expliciet uit "rest") — dus die moeten
    // hier terug worden meegegeven, anders vallen ze terug op de lege standaardwaarde uit
    // initialData: het adres lijkt dan "vergeten" bij het heropenen van een dossier, en
    // aangemaaktOp als lege string doet elke volgende opslagpoging falen met
    // "invalid input syntax for type timestamp with time zone: ''"
    // "data.media" (fotos/documenten/voorpaginaFoto) staat sinds de bandbreedte-optimalisatie in
    // saveDossier() in een aparte kolom — na "...data.data" gespreid zodat oudere dossiers (van
    // vóór die migratie, met fotos/documenten nog inline in "data.data") gewoon blijven werken
    // zolang de "media"-kolom voor dat dossier nog leeg is
    const dossier = {
      ...data.data,
      ...(data.media || {}),
      id: data.id,
      ownerId: data.owner_id,
      status: data.status,
      aangemaaktOp: data.aangemaakt_op,
      straat: data.straat,
      nummer: data.nummer,
      bus: data.bus,
      postcode: data.postcode,
      gemeente: data.gemeente,
    };
    // meteen ook lokaal bijwerken (als een reeds-gesynchroniseerde kopie, "wachtOpSync: false") —
    // zodat dit dossier de volgende keer ook zonder verbinding geopend kan worden. Een eventuele
    // nog-niet-gesynchroniseerde lokale wijziging (wachtOpSync: true) wordt hier bewust NIET
    // overschreven: dat zou een offline gemaakte wijziging net verliezen vóór ze gesynchroniseerd is.
    try {
      const lokaleRecords = await haalWachtendeDossiers();
      const staatNogTeWachten = lokaleRecords.some((r) => r.id === id);
      if (!staatNogTeWachten) await bewaarLokaalDossier(dossier, { wachtOpSync: false });
    } catch (e) {
      console.error("Kon dossier niet lokaal cachen:", e.message);
    }
    return dossier;
  } catch (e) {
    if (!isNetwerkFout(e)) { console.error(e); return null; }
    return await haalLokaalDossier(id);
  }
}

// onthoudt, per dossier-id, of de laatst effectief opgeslagen foto/document-inhoud (na het
// wissen van de tijdelijke blob-url) intussen gewijzigd is — zo kan saveDossier() de zware
// "media"-kolom overslaan wanneer enkel een gewoon tekstveld wijzigde, in plaats van bij élke
// autosave opnieuw alle foto's/documenten (soms meerdere MB aan base64) naar de database te
// sturen. We bewaren enkel een korte hash (zie eenvoudigeHash), nooit de volledige media-JSON
// zelf — die kan immers precies de meerdere MB groot zijn die we net niet nog eens willen
// vasthouden. Naast het in-memory-geheugen van deze paginasessie staat dezelfde hash ook in
// sessionStorage: zo hoeft een gewone paginaherlaad niet meer automatisch de volledige media
// opnieuw te versturen als die sinds de laatste succesvolle opslag niet gewijzigd is — belangrijk
// juist voor een dossier met veel foto's/documenten, waar zo'n overbodige herverzending net het
// verschil kan maken tussen een opslagbeurt die binnen de tijdslimiet blijft of niet.
const _laatstOpgeslagenMedia = new Map();
// eenvoudige, snelle hash (geen cryptografische sterkte nodig, enkel wijzigingsdetectie)
function eenvoudigeHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return `${h.toString(36)}:${str.length}`;
}
function haalLaatstOpgeslagenMediaHash(id) {
  if (_laatstOpgeslagenMedia.has(id)) return _laatstOpgeslagenMedia.get(id);
  try {
    return sessionStorage.getItem(`dossier_media_hash_${id}`) || undefined;
  } catch {
    return undefined; // sessionStorage niet beschikbaar (bv. privénavigatie) — gewoon zonder verder
  }
}
function onthoudLaatstOpgeslagenMediaHash(id, hash) {
  _laatstOpgeslagenMedia.set(id, hash);
  try { sessionStorage.setItem(`dossier_media_hash_${id}`, hash); } catch {}
}

// Welke versie van een dossier deze browser als "de zijne" beschouwt: de waarde van
// laatst_bewerkt op het moment van inladen of van de laatste geslaagde opslagbeurt. Wordt gebruikt
// voor de botsingscontrole in _saveDossierPoging — zie de toelichting daar.
const _verwachteVersie = new Map();
function haalVerwachteVersie(id) { return _verwachteVersie.get(id); }
function onthoudVerwachteVersie(id, versie) { if (versie) _verwachteVersie.set(id, versie); }
function vergeetVerwachteVersie(id) { _verwachteVersie.delete(id); }

// De rij zoals het dossieroverzicht ze verwacht (camelCase) — gedeeld door beide opslagpaden.
function bouwIndexMeta(dossier, laatstBewerkt) {
  return {
    id: dossier.id, ownerId: dossier.ownerId, straat: dossier.straat, nummer: dossier.nummer,
    bus: dossier.bus, postcode: dossier.postcode, gemeente: dossier.gemeente,
    status: dossier.status, aangemaaktOp: dossier.aangemaaktOp,
    laatstBewerkt: laatstBewerkt || new Date().toISOString(),
  };
}

export async function saveDossier(dossier, index, setIndex) {
  // altijd EERST lokaal bewaren, vóór er iets met Supabase geprobeerd wordt: dit mag nooit falen
  // door een netwerkprobleem, en zorgt dat de wijziging sowieso op dit toestel bewaard blijft
  // (inclusief foto's/documenten, die als base64 gewoon deel uitmaken van "dossier" hieronder),
  // ook wanneer de opslagpoging naar de server hierna mislukt of nooit aankomt.
  try {
    await bewaarLokaalDossier(dossier);
  } catch (e) {
    console.error("Kon dossier niet lokaal bewaren:", e.message);
  }
  try {
    return await _saveDossierPoging(dossier, index, setIndex);
  } catch (e) {
    if (!isNetwerkFout(e)) {
      // een onverwachte (niet-netwerk-)fout — dit was voorheen ook al de terugval hier, want
      // supabase-js gooit voor sommige fouten (bv. een echte verbindingsonderbreking halverwege
      // de aanvraag) een fout i.p.v. die als "{ error }" terug te geven.
      console.error("Opslaan mislukt (onverwacht):", e);
      return { ok: false, error: `Opslaan mislukt: ${e.message || e}` };
    }
    // netwerkfout: het dossier staat dankzij de lokale opslag hierboven al veilig op dit toestel —
    // dit is dus geen echte fout meer voor de gebruiker, enkel een uitgestelde synchronisatie
    // (zie synchroniseerWachtendeDossiers hieronder, opgestart zodra de verbinding terugkomt).
    // De index wordt optimistisch bijgewerkt zodat het dossier meteen met zijn nieuwste gegevens
    // in het dashboard verschijnt/blijft staan, in plaats van pas na de effectieve synchronisatie.
    console.warn("Opslaan uitgesteld (geen verbinding), lokaal bewaard:", e.message);
    const meta = bouwIndexMeta(dossier, new Date().toISOString());
    setIndex(index.some((x) => x.id === meta.id) ? index.map((x) => (x.id === meta.id ? meta : x)) : [...index, meta]);
    return { ok: true, offline: true };
  }
}

// probeert alle lokaal wachtende (nog niet gesynchroniseerde) dossiers alsnog naar Supabase weg te
// schrijven — aangeroepen zodra de browser weer online komt (zie het "online"-event in App.jsx) en
// opportunistisch na het opstarten/inloggen. Respecteert dezelfde botsingscontrole als een gewone
// online opslagbeurt (_saveDossierPoging hierboven): een dossier dat intussen door iemand anders
// gewijzigd werd, wordt NOOIT stil overschreven — het blijft dan als "wachtend" staan zodat de
// makelaar het zelf kan nakijken.
export async function synchroniseerWachtendeDossiers(index, setIndex) {
  let wachtend;
  try {
    wachtend = await haalWachtendeDossiers();
  } catch (e) {
    console.error("Kon wachtende dossiers niet ophalen voor synchronisatie:", e.message);
    return { gesynchroniseerd: 0, mislukt: [] };
  }
  let gesynchroniseerd = 0;
  const mislukt = [];
  let huidigeIndex = index;
  const bijwerkenIndex = (nieuw) => { huidigeIndex = nieuw; setIndex(nieuw); };
  for (const record of wachtend) {
    try {
      const resultaat = await _saveDossierPoging(record.dossier, huidigeIndex, bijwerkenIndex);
      if (resultaat.ok) {
        await markeerGesynchroniseerd(record.id);
        gesynchroniseerd++;
      } else {
        mislukt.push({ id: record.id, error: resultaat.error, conflict: !!resultaat.conflict });
      }
    } catch (e) {
      if (!isNetwerkFout(e)) {
        console.error(`Synchronisatie van dossier ${record.id} mislukt:`, e.message);
        mislukt.push({ id: record.id, error: e.message });
        continue;
      }
      // nog steeds (of weer) geen verbinding — stop deze ronde, de eerstvolgende "online"-
      // gebeurtenis of opportunistische aanroep (zie App.jsx) probeert vanzelf opnieuw.
      break;
    }
  }
  return { gesynchroniseerd, mislukt };
}
async function _saveDossierPoging(dossier, index, setIndex) {
  // de tijdelijke blob-url (url) kan niet persisteren over sessies heen en wordt dus niet
  // bewaard — de base64-data (verkleind bij het opladen) blijft wél bewaard, want zonder die
  // data verdwijnen de foto's definitief uit zowel de app-voorbeelden als het rapport zodra een
  // dossier wordt opgeslagen en later heropend. Foto's/documenten blijven, net als vroeger, als
  // base64 bewaard, maar sinds de "media"-kolom (zie migratie-instructies) in een aparte kolom
  // los van de rest van de dossier-data — zo hoeft een gewone tekstwijziging niet telkens alle
  // foto's/documenten opnieuw mee te sturen.
  const { id, ownerId, straat, nummer, bus, postcode, gemeente, status, aangemaaktOp, fotos, documenten, voorpaginaFoto, ...rest } = dossier;
  // extraPanden (zie extraPanden/maakLeegPand) blijft, anders dan het hoofdpand hierboven, gewoon
  // in "rest"/"data" zitten (bewust geen eigen "media"-optimalisatie voor élk pand — dat zou het
  // laad-/opslagpad nog complexer maken voor iets wat pas relevant wordt bij een dossier met veel
  // panden én veel foto's per pand). Wél nog steeds nodig: dezelfde tijdelijke-blob-url-opkuis als
  // bij het hoofdpand — zonder die opkuis zou elk pand-foto na het heropenen van het dossier een
  // gebroken afbeelding tonen (de blob-url overleeft geen paginaherlaad, en "url || base64" in de
  // weergave zou dan de kapotte url gebruiken i.p.v. terug te vallen op de nog geldige base64).
  if (rest.extraPanden && rest.extraPanden.length) {
    rest.extraPanden = rest.extraPanden.map((p) => ({
      ...p,
      fotos: (p.fotos || []).map(({ url, ...r }) => r),
    }));
  }
  const media = {
    fotos: (fotos || []).map(({ url, ...r }) => r),
    // documenten hebben geen tijdelijke blob-url (die wordt enkel bij PDF's intern gebruikt voor
    // de AI-analyse-upload, niet als veld op het object zelf) — dus base64 hier NIET stripping,
    // anders verdwijnt de PDF-inhoud bij het heropenen van een dossier, terwijl "PDF gereed voor
    // AI-uitlezing" en "Gegevens automatisch invullen" net op die base64 steunen
    documenten: documenten || [],
    voorpaginaFoto: voorpaginaFoto ? (({ url, ...r }) => r)(voorpaginaFoto) : null,
  };
  const mediaJson = JSON.stringify(media);
  const mediaHash = eenvoudigeHash(mediaJson);
  const mediaGewijzigd = haalLaatstOpgeslagenMediaHash(id) !== mediaHash;

  const basisPayload = {
    id,
    owner_id: ownerId,
    straat: straat || "",
    nummer: nummer || "",
    bus: bus || "",
    postcode: postcode || "",
    gemeente: gemeente || "",
    status: status || "concept",
    aangemaakt_op: aangemaaktOp,
    data: rest,
  };
  // ---- botsingscontrole ----
  // Twee mensen in hetzelfde dossier (bv. de eigenaar én een beheerder, die daar volgens de
  // toegangsregels mag werken) overschreven elkaar voordien geruisloos: de laatste opslagbeurt won,
  // zonder melding aan wie dan ook. We schrijven daarom voorwaardelijk weg: enkel als de rij nog
  // exact de versie is die wij hebben ingeladen. Is dat niet zo, dan wordt er NIETS overschreven en
  // krijgt de gebruiker een duidelijke melding.
  // Bewust defensief: kennen we de verwachte versie niet (nieuw dossier, of na een paginaherlaad),
  // dan valt de code terug op het oude, onvoorwaardelijke gedrag — opslaan mag nooit vastlopen door
  // deze controle zelf.
  const verwachteVersie = haalVerwachteVersie(id);
  const payload = mediaGewijzigd ? { ...basisPayload, media } : basisPayload;
  if (verwachteVersie) {
    const { data: bijgewerkt, error: updateFout } = await supabase
      .from("dossiers").update(payload).eq("id", id).eq("laatst_bewerkt", verwachteVersie).select("laatst_bewerkt");
    if (!updateFout && Array.isArray(bijgewerkt) && bijgewerkt.length === 0) {
      // niets bijgewerkt: ofwel is de rij intussen door iemand anders gewijzigd, ofwel bestaat ze
      // niet meer. Even nakijken wélk van de twee, want enkel het eerste is een echte botsing.
      const { data: huidig } = await supabase.from("dossiers").select("laatst_bewerkt").eq("id", id).maybeSingle();
      if (huidig) {
        return {
          ok: false,
          conflict: true,
          error: "Dit dossier is intussen door iemand anders gewijzigd. Je wijzigingen zijn NIET opgeslagen — herlaad de pagina om de recentste versie te zien voor je verder werkt.",
        };
      }
      vergeetVerwachteVersie(id); // rij bestaat niet meer: hieronder gewoon opnieuw aanmaken
    } else if (!updateFout && Array.isArray(bijgewerkt) && bijgewerkt.length > 0) {
      onthoudVerwachteVersie(id, bijgewerkt[0].laatst_bewerkt);
      if (mediaGewijzigd) onthoudLaatstOpgeslagenMediaHash(id, mediaHash);
      // net als het pad hieronder ook het dossieroverzicht bijwerken, anders blijft bv. een
      // gewijzigd adres daar op de oude waarde staan
      const meta = bouwIndexMeta(dossier, bijgewerkt[0].laatst_bewerkt);
      setIndex(index.some((x) => x.id === meta.id) ? index.map((x) => (x.id === meta.id ? meta : x)) : [...index, meta]);
      return { ok: true };
    }
    // bij een fout (bv. de media-kolom bestaat nog niet) valt de code door naar de upsert hieronder
  }

  let { error } = await supabase.from("dossiers").upsert(
    mediaGewijzigd ? { ...basisPayload, media } : basisPayload
  );
  // valt terug op het oude gedrag (media mee in de "data"-kolom) zolang de "media"-kolom nog
  // niet bestaat in Supabase (bv. de migratie is nog niet uitgevoerd) — zo blijft opslaan altijd
  // werken, ongeacht de volgorde waarin code-deploy en databasemigratie gebeuren.
  if (error && /media/i.test(error.message || "") && mediaGewijzigd) {
    ({ error } = await supabase.from("dossiers").upsert({ ...basisPayload, data: { ...rest, ...media } }));
  }
  if (error) {
    // een netwerkfout hier moet NIET als gewone foutmelding aan de gebruiker getoond worden — de
    // aanroeper (saveDossier hierboven, of synchroniseerWachtendeDossiers) vangt dit specifiek op
    // om in plaats daarvan de "lokaal bewaard, synchronisatie volgt"-afhandeling te geven.
    if (isNetwerkFout(error)) throw error;
    console.error("Opslaan mislukt:", error.message);
    // een grote PDF/foto (bv. een uitgebreide RealSmart-bundel of een scherpe grondplan-foto) kan
    // de toegestane omvang van één opslagbeurt overschrijden, of gewoon te lang duren om weg te
    // schrijven — Postgres/Supabase breekt zo'n te trage opslagbeurt zelf af met "canceling
    // statement due to statement timeout" (geen "te groot"-foutmelding, maar in de praktijk
    // meestal dezelfde oorzaak). Dit geeft de gebruiker in beide gevallen een duidelijke,
    // herkenbare melding in plaats van dat het document en de eruit gehaalde gegevens stilzwijgend
    // verdwijnen.
    const teGroot = /too large|payload|exceed|size|request entity|timeout/i.test(error.message || "");
    return {
      ok: false,
      error: teGroot
        ? "Opslaan mislukt: een bijlage (foto of document) is te groot, of het opslaan duurde te lang. Verklein het bestand (bv. via een online PDF-compressor, of een scherpere foto opnieuw nemen met minder detail) en probeer opnieuw."
        : `Opslaan mislukt: ${error.message}`,
    };
  }
  if (mediaGewijzigd) onthoudLaatstOpgeslagenMediaHash(id, mediaHash);
  // versie ophalen zodat de VOLGENDE opslagbeurt wél voorwaardelijk kan schrijven (botsingscontrole
  // hierboven) — een mislukte leesbeurt is niet erg: dan blijft het gedrag zoals het altijd was
  const { data: naSchrijven } = await supabase.from("dossiers").select("laatst_bewerkt").eq("id", id).maybeSingle();
  if (naSchrijven?.laatst_bewerkt) onthoudVerwachteVersie(id, naSchrijven.laatst_bewerkt);
  const meta = bouwIndexMeta(dossier, naSchrijven?.laatst_bewerkt);
  const next = index.some((x) => x.id === meta.id) ? index.map((x) => (x.id === meta.id ? meta : x)) : [...index, meta];
  setIndex(next);
  return { ok: true };
}
// Alle bestanden van één dossier uit Storage halen. Dit MOET gebeuren vóór de dossierrij zelf
// verdwijnt: de toegangsregels op de bucket controleren of het bijhorende dossier nog bestaat (zie
// supabase/schema.sql), dus zodra de rij weg is, zijn de bestanden voor niemand nog leesbaar of
// verwijderbaar — ze bleven permanent achter, mét persoonsgegevens (aktes, attesten), terwijl de
// privacyverklaring in de app belooft dat alles definitief gewist wordt.
async function verwijderDossierBestanden(dossierId) {
  const paden = [];
  const mappen = ["", "/documenten", "/fotos", "/ai-analyse", "/pdf-render"];
  for (const submap of mappen) {
    const { data, error } = await supabase.storage.from("dossier-bijlagen").list(`${dossierId}${submap}`, { limit: 1000 });
    if (error || !data) continue;
    data.forEach((item) => {
      // een "map" komt terug zonder id; enkel echte bestanden verwijderen
      if (item.id) paden.push(`${dossierId}${submap}/${item.name}`.replace(/\/\//g, "/"));
    });
  }
  if (paden.length === 0) return { ok: true, aantal: 0 };
  const { error } = await supabase.storage.from("dossier-bijlagen").remove(paden);
  if (error) return { ok: false, error: error.message };
  return { ok: true, aantal: paden.length };
}

export async function deleteDossier(id, index, setIndex) {
  // eerst de bijlagen, dan pas de rij — zie verwijderDossierBestanden hierboven
  const bestanden = await verwijderDossierBestanden(id);
  if (!bestanden.ok) {
    console.error("Bijlagen verwijderen mislukt:", bestanden.error);
    return { ok: false, error: `De bijlagen van dit dossier konden niet verwijderd worden (${bestanden.error}). Het dossier is daarom bewaard gebleven — probeer het later opnieuw.` };
  }
  const { error } = await supabase.from("dossiers").delete().eq("id", id);
  if (error) {
    // bewust NIET meer optimistisch lokaal verwijderen bij een mislukte server-verwijdering —
    // voorheen verdween de rij hier hoe dan ook uit de lijst, ook als de echte verwijdering op
    // de server gefaald was, zodat de gebruiker nooit zag dat het dossier eigenlijk nog bestond.
    console.error("Verwijderen mislukt:", error.message);
    return { ok: false, error: error.message };
  }
  const next = index.filter((x) => x.id !== id);
  setIndex(next);
  return { ok: true };
}

// eenvoudig logboek van wie een dossier aanmaakte, verwijderde, of als beheerder het dossier van
// een collega opende — bij een geschil of vergissing rond een document dat jarenlang juridisch
// relevant kan blijven (Vlabel/nalatenschap), is dit anders achteraf nergens te reconstrueren
// (zie audit, punt H4; tabel + toegangsregels in supabase/schema.sql). Bewust "fire-and-forget":
// een mislukte logregel mag nooit de eigenlijke actie (aanmaken/verwijderen/openen) blokkeren of
// vertragen, vandaar geen "await" op de aanroepplaatsen hieronder.
export function logDossierEvent(dossierId, gebruikerId, actie, details) {
  if (!gebruikerId) return;
  supabase.from("dossier_events").insert({
    dossier_id: dossierId, gebruiker_id: gebruikerId, actie, details: details || null,
  }).then(({ error }) => {
    if (error) console.error("Kon logboekregel niet wegschrijven:", error.message);
  });
}
