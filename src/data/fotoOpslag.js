// ----------------------------------------------------------------------------
// data/fotoOpslag.js — foto's in Supabase Storage i.p.v. in de databank
// ----------------------------------------------------------------------------
// Foto's stonden als base64-tekst in de databank (kolom "media", en bij extra panden in "data"):
// gemiddeld 1,9 MB per dossier, tot 19 MB. Elke fotowijziging stuurde alles opnieuw en elk
// geopend dossier laadde alles uit de databank — zwaar voor een kleine databankserver.
//
// Nu: elke foto wordt één keer als bestand opgeladen naar de bestaande, private bucket
// "dossier-bijlagen" (<dossier-id>/fotos/<foto-id>.<ext>, zelfde toegangsregels als de
// documenten). In de databank staat enkel nog het pad. Bij het openen worden de foto's uit
// Storage teruggehaald en weer als base64 in het dossier gezet — de rest van de app (fototabblad,
// voorblad, verslag, PDF) werkt dus exact zoals voorheen.
//
// Vangnetten:
//   - Lukt het opladen niet (offline, een niet-toegelaten bestandstype), dan blijft de foto zoals
//     vroeger als base64 in de databank staan — er gaat nooit een foto verloren.
//   - Oude dossiers met foto's in de databank blijven gewoon werken; bij de eerstvolgende opslag
//     verhuizen hun foto's vanzelf naar Storage.
//   - Een foto die uit het dossier verwijderd werd, wordt na een geslaagde opslag ook uit Storage
//     gewist — enkel foto's die deze sessie zelf kende, zodat een foto die een collega intussen
//     toevoegde nooit per ongeluk verdwijnt.
import { supabase } from "./supabase.js";

const BUCKET = "dossier-bijlagen";
const TOEGELATEN = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

// per dossier: pad -> vingerafdruk van de opgeladen inhoud (zo wordt niets twee keer opgeladen)
const _opgeladen = new Map();
const opgeladenVoor = (dossierId) => {
  if (!_opgeladen.has(dossierId)) _opgeladen.set(dossierId, new Map());
  return _opgeladen.get(dossierId);
};

// snelle vingerafdruk van een (grote) base64-tekst: lengte + stalen verspreid over de tekst
export function vingerafdruk(tekst) {
  const s = String(tekst || "");
  let h = s.length | 0;
  const stap = Math.max(1, Math.floor(s.length / 4096));
  for (let i = 0; i < s.length; i += stap) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

const mimeVan = (dataUrl) => (/^data:([^;,]+)[;,]/.exec(String(dataUrl || "")) || [])[1] || "";
const isDataUrl = (v) => /^data:image\/[a-z+.-]+;base64,/i.test(String(v || ""));

export function fotoPad(dossierId, foto, soort = "") {
  const ext = TOEGELATEN[mimeVan(foto.base64)] || (String(foto.pad || "").split(".").pop()) || "jpg";
  return `${dossierId}/fotos/${soort}${foto.id}.${ext}`;
}

// alle foto's van een dossier, met een functie om ze te vervangen: { foto, soort, zet(nieuweFoto) }
function verzamelFotos(dossier) {
  const lijst = [];
  (dossier.fotos || []).forEach((f, i) => lijst.push({ foto: f, soort: "", plaats: ["fotos", i] }));
  if (dossier.voorpaginaFoto) lijst.push({ foto: dossier.voorpaginaFoto, soort: "voorblad-", plaats: ["voorpaginaFoto"] });
  (dossier.extraPanden || []).forEach((p, pi) => {
    (p.fotos || []).forEach((f, i) => lijst.push({ foto: f, soort: "", plaats: ["extraPanden", pi, "fotos", i] }));
    if (p.voorpaginaFoto) lijst.push({ foto: p.voorpaginaFoto, soort: "voorblad-", plaats: ["extraPanden", pi, "voorpaginaFoto"] });
  });
  return lijst.filter((x) => x.foto && x.foto.id);
}

// kopie van het dossier met een aanpassing per foto (zonder het origineel te wijzigen)
function mapFotos(dossier, fn) {
  const nieuweFoto = (f, soort) => (f && f.id ? fn(f, soort) : f);
  return {
    ...dossier,
    ...(dossier.fotos ? { fotos: dossier.fotos.map((f) => nieuweFoto(f, "")) } : {}),
    ...(dossier.voorpaginaFoto ? { voorpaginaFoto: nieuweFoto(dossier.voorpaginaFoto, "voorblad-") } : {}),
    ...(dossier.extraPanden ? {
      extraPanden: dossier.extraPanden.map((p) => ({
        ...p,
        ...(p.fotos ? { fotos: p.fotos.map((f) => nieuweFoto(f, "")) } : {}),
        ...(p.voorpaginaFoto ? { voorpaginaFoto: nieuweFoto(p.voorpaginaFoto, "voorblad-") } : {}),
      })),
    } : {}),
  };
}

function dataUrlNaarBlob(dataUrl) {
  const mime = mimeVan(dataUrl);
  const schoon = String(dataUrl).replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  const bytes = Uint8Array.from(atob(schoon), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

// Foto's die nog niet (of met andere inhoud) in Storage staan, opladen. Mislukt er één, dan
// blijft die gewoon als base64 bewaard. Geeft het aantal nieuw opgeladen foto's terug.
export async function laadFotosOp(dossier, { gelijktijdig = 4 } = {}) {
  const id = dossier && dossier.id;
  if (!id) return 0;
  const gekend = opgeladenVoor(id);
  const teDoen = verzamelFotos(dossier).filter(({ foto, soort }) => isDataUrl(foto.base64) && TOEGELATEN[mimeVan(foto.base64)]
    && gekend.get(fotoPad(id, foto, soort)) !== vingerafdruk(foto.base64));
  let nieuw = 0;
  const wachtrij = [...teDoen];
  await Promise.all(Array.from({ length: Math.min(gelijktijdig, wachtrij.length) }, async () => {
    while (wachtrij.length) {
      const { foto, soort } = wachtrij.shift();
      const pad = fotoPad(id, foto, soort);
      try {
        const { error } = await supabase.storage.from(BUCKET).upload(pad, dataUrlNaarBlob(foto.base64), {
          contentType: mimeVan(foto.base64), upsert: true,
        });
        if (error) { console.warn(`Foto niet opgeladen (${pad}):`, error.message); continue; }
        gekend.set(pad, vingerafdruk(foto.base64));
        nieuw++;
      } catch (e) {
        console.warn(`Foto niet opgeladen (${pad}):`, e.message);
      }
    }
  }));
  return nieuw;
}

// Wat er in de databank komt: foto's die in Storage staan zonder base64 (enkel het pad), de
// andere ongewijzigd (base64 als vangnet). Tijdelijke blob-urls gaan nooit mee.
export function zonderOpgeladenFotos(dossier) {
  const id = dossier && dossier.id;
  const gekend = id ? opgeladenVoor(id) : new Map();
  return mapFotos(dossier, (foto, soort) => {
    const { url, ...rest } = foto;
    if (!isDataUrl(rest.base64)) return rest;
    const pad = fotoPad(id, rest, soort);
    if (gekend.get(pad) === vingerafdruk(rest.base64)) {
      const { base64, ...zonder } = rest;
      return { ...zonder, pad };
    }
    return rest;
  });
}

async function blobNaarDataUrl(blob) {
  if (typeof FileReader !== "undefined") {
    return await new Promise((ok, fout) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => fout(r.error);
      r.readAsDataURL(blob);
    });
  }
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return `data:${blob.type || "image/jpeg"};base64,${btoa(bin)}`;
}

// Bij het openen: foto's met enkel een pad terug als base64 in het dossier zetten.
export async function haalFotosBinnen(dossier, { gelijktijdig = 6 } = {}) {
  const id = dossier && dossier.id;
  if (!id) return dossier;
  const gekend = opgeladenVoor(id);
  const nodig = verzamelFotos(dossier).filter(({ foto }) => foto.pad && !isDataUrl(foto.base64));
  // foto's die al in Storage staan (ook met base64 erbij), zijn gekend: niet opnieuw opladen
  verzamelFotos(dossier).forEach(({ foto }) => {
    if (foto.pad && isDataUrl(foto.base64)) gekend.set(foto.pad, vingerafdruk(foto.base64));
  });
  if (!nodig.length) return dossier;
  const opgehaald = new Map();
  const wachtrij = nodig.map((x) => x.foto.pad);
  await Promise.all(Array.from({ length: Math.min(gelijktijdig, wachtrij.length) }, async () => {
    while (wachtrij.length) {
      const pad = wachtrij.shift();
      try {
        const { data, error } = await supabase.storage.from(BUCKET).download(pad);
        if (error || !data) { console.warn(`Foto niet gevonden (${pad}):`, error && error.message); continue; }
        const dataUrl = await blobNaarDataUrl(data);
        opgehaald.set(pad, dataUrl);
        gekend.set(pad, vingerafdruk(dataUrl));
      } catch (e) {
        console.warn(`Foto niet opgehaald (${pad}):`, e.message);
      }
    }
  }));
  return mapFotos(dossier, (foto) => {
    if (!foto.pad || isDataUrl(foto.base64)) return foto;
    const dataUrl = opgehaald.get(foto.pad);
    // niet gevonden: het pad blijft bewaard (er gaat niets verloren), het fototabblad toont dan een
    // lege plaats i.p.v. een eindeloze laadcirkel
    return dataUrl ? { ...foto, base64: dataUrl } : { ...foto, base64: "", nietGevonden: true };
  });
}

// Na een geslaagde opslag: foto's die deze sessie in Storage kende maar die niet meer in het
// dossier zitten, uit Storage wissen.
export async function ruimVerwijderdeFotosOp(dossier) {
  const id = dossier && dossier.id;
  if (!id || !_opgeladen.has(id)) return 0;
  const gekend = opgeladenVoor(id);
  const inGebruik = new Set(verzamelFotos(dossier).flatMap(({ foto, soort }) => [foto.pad, isDataUrl(foto.base64) ? fotoPad(id, foto, soort) : null]).filter(Boolean));
  // enkel bestanden in de fotomap van DIT dossier
  const weg = [...gekend.keys()].filter((pad) => pad.startsWith(`${id}/fotos/`) && !inGebruik.has(pad));
  if (!weg.length) return 0;
  try {
    const { error } = await supabase.storage.from(BUCKET).remove(weg);
    if (error) { console.warn("Verwijderde foto's niet gewist:", error.message); return 0; }
    weg.forEach((pad) => gekend.delete(pad));
    return weg.length;
  } catch (e) {
    console.warn("Verwijderde foto's niet gewist:", e.message);
    return 0;
  }
}

// Hoeveel bytes een base64-data-URL voorstelt (zonder te decoderen)
export function bytesVanDataUrl(dataUrl) {
  const b64 = String(dataUrl || "").replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  if (!b64) return 0;
  const opvulling = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - opvulling;
}

// Staan er in dit dossier nog foto's als base64 (in de databank)?
export function telFotosInDatabank(dossier) {
  return verzamelFotos(dossier).filter(({ foto }) => isDataUrl(foto.base64)).length;
}

// Controle na het opladen (fotoverhuis): staat elke foto die deze sessie als "opgeladen" kent ook
// echt volledig in Storage? Eén opvraging van de fotomap van het dossier; een foto waarvan het
// bestand ontbreekt of een andere grootte heeft, wordt vergeten — die blijft dan als base64 in de
// databank staan (zonderOpgeladenFotos laat ze ongemoeid). Geeft { goed, afgekeurd } terug.
export async function controleerOpgeladenFotos(dossier) {
  const id = dossier && dossier.id;
  if (!id) return { goed: 0, afgekeurd: 0 };
  const gekend = opgeladenVoor(id);
  const teControleren = verzamelFotos(dossier)
    .filter(({ foto }) => isDataUrl(foto.base64))
    .map(({ foto, soort }) => ({ pad: fotoPad(id, foto, soort), foto }))
    .filter(({ pad, foto }) => gekend.get(pad) === vingerafdruk(foto.base64));
  if (!teControleren.length) return { goed: 0, afgekeurd: 0 };
  let grootte = new Map();
  try {
    const { data, error } = await supabase.storage.from(BUCKET).list(`${id}/fotos`, { limit: 1000 });
    if (error) throw error;
    grootte = new Map((data || []).map((b) => [`${id}/fotos/${b.name}`, b.metadata && Number(b.metadata.size)]));
  } catch (e) {
    // controle onmogelijk: niets als opgeladen beschouwen, alles blijft in de databank
    teControleren.forEach(({ pad }) => gekend.delete(pad));
    return { goed: 0, afgekeurd: teControleren.length };
  }
  let goed = 0, afgekeurd = 0;
  for (const { pad, foto } of teControleren) {
    if (grootte.get(pad) === bytesVanDataUrl(foto.base64)) goed++;
    else { gekend.delete(pad); afgekeurd++; }
  }
  return { goed, afgekeurd };
}

// enkel voor de tests
export function _vergeetFotoOpslag() { _opgeladen.clear(); }
