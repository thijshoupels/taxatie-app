// ----------------------------------------------------------------------------
// lib/xlsLezen.js — leest een oud Excel-bestand (.xls, BIFF8) in de browser, zonder extra pakket
// ----------------------------------------------------------------------------
// Waarom zelf geschreven: de verkoopprijzenlijsten van Vlabel ("vergelijkingspunten") komen als
// .xls (Excel 97-2003, BIFF8 in een "Compound File"-container). De gangbare bibliotheek (SheetJS)
// zou een nieuwe npm-afhankelijkheid betekenen, en package.json blijft bewust ongewijzigd (zie ook
// data/lokaleOpslag.js). We hebben enkel de celwaarden nodig — geen opmaak, formules of grafieken —
// en daarvoor volstaat een beperkte lezer:
//   1. de Compound File openen (FAT/mini-FAT, mappenstructuur) en de "Workbook"-stroom ophalen;
//   2. in die stroom de BIFF8-records overlopen: bladnamen (BOUNDSHEET), de gedeelde
//      tekstentabel (SST, incl. vervolgrecords CONTINUE) en de celrecords (LABELSST, NUMBER, RK,
//      MULRK, LABEL, FORMULA + STRING, BOOLERR).
// Datums komen terug als Excel-serienummer (bv. 45636): de aanroeper weet welke kolommen datums
// zijn (zie excelDatumNaarIso hieronder). Pure functie, zonder DOM — ook in Node testbaar.

const HANDTEKENING = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const EINDE_KETEN = 0xfffffffe;
const VRIJ = 0xffffffff;

function alsBytes(invoer) {
  if (invoer instanceof Uint8Array) return invoer;
  if (invoer instanceof ArrayBuffer) return new Uint8Array(invoer);
  if (ArrayBuffer.isView(invoer)) return new Uint8Array(invoer.buffer, invoer.byteOffset, invoer.byteLength);
  throw new Error("Onbekend bestandsformaat (verwacht een ArrayBuffer).");
}

// ---------- 1. Compound File ----------
function leesCompoundFile(bytes) {
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== HANDTEKENING[i]) {
      throw new Error("Dit is geen oud Excel-bestand (.xls). Laad de lijst op zoals je ze van Vlabel kreeg.");
    }
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sectorGrootte = 1 << dv.getUint16(0x1e, true);
  const miniSectorGrootte = 1 << dv.getUint16(0x20, true);
  const eersteMapSector = dv.getUint32(0x30, true);
  const miniGrens = dv.getUint32(0x38, true);
  const eersteMiniFatSector = dv.getUint32(0x3c, true);
  const eersteDifatSector = dv.getUint32(0x44, true);
  const aantalDifatSectoren = dv.getUint32(0x48, true);

  const sectorOffset = (s) => (s + 1) * sectorGrootte;
  const u32 = (off) => (off + 4 <= bytes.length ? dv.getUint32(off, true) : VRIJ);

  // FAT-sectoren: 109 in de kop, de rest via de DIFAT-keten
  const fatSectoren = [];
  for (let i = 0; i < 109; i++) {
    const s = u32(0x4c + i * 4);
    if (s !== VRIJ && s !== EINDE_KETEN) fatSectoren.push(s);
  }
  let difat = eersteDifatSector;
  const perDifat = sectorGrootte / 4 - 1;
  for (let n = 0; n < aantalDifatSectoren && difat !== EINDE_KETEN && difat !== VRIJ; n++) {
    const off = sectorOffset(difat);
    for (let i = 0; i < perDifat; i++) {
      const s = u32(off + i * 4);
      if (s !== VRIJ && s !== EINDE_KETEN) fatSectoren.push(s);
    }
    difat = u32(off + perDifat * 4);
  }
  const fat = [];
  for (const s of fatSectoren) {
    const off = sectorOffset(s);
    for (let i = 0; i < sectorGrootte / 4; i++) fat.push(u32(off + i * 4));
  }

  const keten = (start, tabel) => {
    const uit = [];
    const gezien = new Set();
    for (let s = start; s !== EINDE_KETEN && s !== VRIJ && s < tabel.length; s = tabel[s]) {
      if (gezien.has(s)) throw new Error("Beschadigd Excel-bestand (lus in de sectorketen).");
      gezien.add(s);
      uit.push(s);
    }
    return uit;
  };
  const leesKeten = (start, grootte) => {
    const sectoren = keten(start, fat);
    const uit = new Uint8Array(sectoren.length * sectorGrootte);
    sectoren.forEach((s, i) => {
      const off = sectorOffset(s);
      uit.set(bytes.subarray(off, Math.min(off + sectorGrootte, bytes.length)), i * sectorGrootte);
    });
    return grootte === undefined ? uit : uit.subarray(0, grootte);
  };

  // mappenstructuur
  const mappen = leesKeten(eersteMapSector);
  const mdv = new DataView(mappen.buffer, mappen.byteOffset, mappen.byteLength);
  const items = [];
  for (let off = 0; off + 128 <= mappen.length; off += 128) {
    const naamLengte = mdv.getUint16(off + 0x40, true);
    let naam = "";
    for (let i = 0; i + 2 < naamLengte && i < 64; i += 2) naam += String.fromCharCode(mdv.getUint16(off + i, true));
    items.push({ naam, type: mappen[off + 0x42], start: mdv.getUint32(off + 0x74, true), grootte: mdv.getUint32(off + 0x78, true) });
  }
  const wortel = items.find((it) => it.type === 5);
  let miniStroom = null;
  let miniFat = null;
  const leesStroom = (item) => {
    if (item.grootte >= miniGrens) return leesKeten(item.start, item.grootte);
    // kleine stroom: via de mini-FAT binnen de mini-stroom van de wortel
    if (!miniStroom) {
      miniStroom = leesKeten(wortel.start, wortel.grootte);
      const mf = leesKeten(eersteMiniFatSector);
      const mfdv = new DataView(mf.buffer, mf.byteOffset, mf.byteLength);
      miniFat = [];
      for (let i = 0; i + 4 <= mf.length; i += 4) miniFat.push(mfdv.getUint32(i, true));
    }
    const sectoren = keten(item.start, miniFat);
    const uit = new Uint8Array(sectoren.length * miniSectorGrootte);
    sectoren.forEach((s, i) => uit.set(miniStroom.subarray(s * miniSectorGrootte, (s + 1) * miniSectorGrootte), i * miniSectorGrootte));
    return uit.subarray(0, item.grootte);
  };
  return { items, leesStroom };
}

// ---------- 2. BIFF8 ----------
// Leest tekst die over meerdere records (SST + CONTINUE, of STRING + CONTINUE) verdeeld kan zijn.
// Belangrijk detail uit de BIFF8-specificatie: loopt een tekst door in een volgend CONTINUE-record,
// dan begint dat record opnieuw met één "vlaggen"-byte die zegt of de tekens daar 1 of 2 bytes
// breed zijn — de breedte kan dus halverwege een tekst wisselen.
class RecordLezer {
  constructor(stukken) {
    this.stukken = stukken; // Uint8Array per record (het eerste + de CONTINUE's)
    this.i = 0;
    this.pos = 0;
  }
  get huidig() { return this.stukken[this.i]; }
  rest() { return this.huidig ? this.huidig.length - this.pos : 0; }
  volgendStuk() { this.i++; this.pos = 0; }
  zorgVoor(n) { if (this.rest() < n && this.rest() === 0) this.volgendStuk(); }
  u8() { this.zorgVoor(1); return this.huidig[this.pos++]; }
  u16() { this.zorgVoor(2); const b = this.huidig; const v = b[this.pos] | (b[this.pos + 1] << 8); this.pos += 2; return v; }
  u32() { this.zorgVoor(4); const b = this.huidig; const v = (b[this.pos] | (b[this.pos + 1] << 8) | (b[this.pos + 2] << 16)) + b[this.pos + 3] * 0x1000000; this.pos += 4; return v; }
  overslaan(n) {
    while (n > 0 && this.huidig) {
      const stap = Math.min(n, this.rest());
      this.pos += stap;
      n -= stap;
      if (n > 0) this.volgendStuk();
    }
  }
  tekens(aantal, breed) {
    let uit = "";
    let resterend = aantal;
    let tweeBytes = breed;
    while (resterend > 0 && this.huidig) {
      if (this.rest() === 0) {
        this.volgendStuk();
        if (!this.huidig) break;
        tweeBytes = (this.huidig[this.pos++] & 1) === 1; // nieuwe vlaggen-byte bij vervolg
      }
      const b = this.huidig;
      const beschikbaar = Math.floor(this.rest() / (tweeBytes ? 2 : 1));
      const n = Math.min(resterend, beschikbaar);
      for (let k = 0; k < n; k++) {
        uit += tweeBytes ? String.fromCharCode(b[this.pos] | (b[this.pos + 1] << 8)) : String.fromCharCode(b[this.pos]);
        this.pos += tweeBytes ? 2 : 1;
      }
      resterend -= n;
      if (n === 0) this.pos = b.length; // oneven restbyte: naar het volgende stuk
    }
    return uit;
  }
  // XLUnicodeRichExtendedString (SST) of XLUnicodeString (STRING/LABEL, zonder rich/ext)
  unicodeTekst() {
    const aantal = this.u16();
    const vlaggen = this.u8();
    const rich = (vlaggen & 0x08) ? this.u16() : 0;
    const ext = (vlaggen & 0x04) ? this.u32() : 0;
    const tekst = this.tekens(aantal, (vlaggen & 1) === 1);
    this.overslaan(rich * 4 + ext);
    return tekst;
  }
}

function rkWaarde(rk) {
  let waarde;
  if (rk & 0x02) {
    waarde = rk >> 2; // 30-bits geheel getal (met teken)
  } else {
    const buf = new DataView(new ArrayBuffer(8));
    buf.setUint32(4, rk & 0xfffffffc, true);
    buf.setUint32(0, 0, true);
    waarde = buf.getFloat64(0, true);
  }
  return (rk & 0x01) ? waarde / 100 : waarde;
}

function* records(stroom) {
  const dv = new DataView(stroom.buffer, stroom.byteOffset, stroom.byteLength);
  let pos = 0;
  while (pos + 4 <= stroom.length) {
    const type = dv.getUint16(pos, true);
    const lengte = dv.getUint16(pos + 2, true);
    const start = pos + 4;
    if (start + lengte > stroom.length) return;
    yield { type, data: stroom.subarray(start, start + lengte), pos };
    pos = start + lengte;
  }
}

export function leesXls(invoer) {
  const bytes = alsBytes(invoer);
  const cf = leesCompoundFile(bytes);
  const werkboek = cf.items.find((it) => it.type === 2 && (it.naam === "Workbook" || it.naam === "Book"));
  if (!werkboek) throw new Error("Geen werkboek gevonden in dit Excel-bestand.");
  const stroom = cf.leesStroom(werkboek);

  // eerste doorgang: globale gegevens (bladen + gedeelde teksten)
  const bladen = [];
  const sst = [];
  const lijst = [...records(stroom)];
  for (let r = 0; r < lijst.length; r++) {
    const { type, data } = lijst[r];
    if (type === 0x0085) { // BOUNDSHEET
      const ddv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const lezer = new RecordLezer([data.subarray(6)]);
      const aantal = lezer.u8();
      const vlaggen = lezer.u8();
      bladen.push({ offset: ddv.getUint32(0, true), soort: data[5], naam: lezer.tekens(aantal, (vlaggen & 1) === 1) });
    } else if (type === 0x00fc) { // SST (+ CONTINUE)
      const stukken = [data];
      while (lijst[r + 1] && lijst[r + 1].type === 0x003c) stukken.push(lijst[++r].data);
      const lezer = new RecordLezer(stukken);
      lezer.u32(); // totaal aantal verwijzingen
      const uniek = lezer.u32();
      for (let i = 0; i < uniek && lezer.huidig; i++) sst.push(lezer.unicodeTekst());
    }
  }

  // tweede doorgang: per werkblad de cellen
  const perOffset = new Map(lijst.map((rec, idx) => [rec.pos, idx]));
  const resultaat = [];
  for (const blad of bladen) {
    if (blad.soort !== 0) continue; // enkel gewone werkbladen (geen grafiekbladen/macro's)
    const cellen = new Map();
    let maxRij = -1, maxKol = -1;
    const zet = (rij, kol, waarde) => {
      if (!cellen.has(rij)) cellen.set(rij, new Map());
      cellen.get(rij).set(kol, waarde);
      if (rij > maxRij) maxRij = rij;
      if (kol > maxKol) maxKol = kol;
    };
    let idx = perOffset.get(blad.offset);
    if (idx === undefined) continue;
    let wachtOpTekstVoor = null; // FORMULA met tekstresultaat: de tekst volgt in een STRING-record
    for (idx = idx + 1; idx < lijst.length; idx++) {
      const { type, data } = lijst[idx];
      if (type === 0x000a) break; // EOF van dit blad
      const ddv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const rij = () => ddv.getUint16(0, true);
      const kol = () => ddv.getUint16(2, true);
      if (type === 0x00fd && data.length >= 10) { // LABELSST
        zet(rij(), kol(), sst[ddv.getUint32(6, true)] ?? "");
      } else if (type === 0x0203 && data.length >= 14) { // NUMBER
        zet(rij(), kol(), ddv.getFloat64(6, true));
      } else if (type === 0x027e && data.length >= 10) { // RK
        zet(rij(), kol(), rkWaarde(ddv.getUint32(6, true)));
      } else if (type === 0x00bd && data.length >= 6) { // MULRK
        const r0 = rij(); const k0 = kol();
        const aantal = (data.length - 6) / 6;
        for (let k = 0; k < aantal; k++) zet(r0, k0 + k, rkWaarde(ddv.getUint32(4 + k * 6 + 2, true)));
      } else if (type === 0x0204 && data.length >= 9) { // LABEL
        const stukken = [data.subarray(6)];
        while (lijst[idx + 1] && lijst[idx + 1].type === 0x003c) stukken.push(lijst[++idx].data);
        const lezer = new RecordLezer(stukken);
        const aantal = lezer.u16();
        const vlaggen = lezer.u8();
        zet(rij(), kol(), lezer.tekens(aantal, (vlaggen & 1) === 1));
      } else if (type === 0x0006 && data.length >= 14) { // FORMULA: enkel het bewaarde resultaat
        const r0 = rij(); const k0 = kol();
        if (data[12] === 0xff && data[13] === 0xff) {
          const soort = data[6];
          if (soort === 0) wachtOpTekstVoor = [r0, k0];
          else if (soort === 1) zet(r0, k0, data[8] !== 0);
          else if (soort === 3) zet(r0, k0, "");
        } else {
          zet(r0, k0, ddv.getFloat64(6, true));
        }
      } else if (type === 0x0207 && wachtOpTekstVoor) { // STRING (resultaat van de vorige FORMULA)
        const stukken = [data];
        while (lijst[idx + 1] && lijst[idx + 1].type === 0x003c) stukken.push(lijst[++idx].data);
        zet(wachtOpTekstVoor[0], wachtOpTekstVoor[1], new RecordLezer(stukken).unicodeTekst());
        wachtOpTekstVoor = null;
      } else if (type === 0x0205 && data.length >= 8) { // BOOLERR
        zet(rij(), kol(), data[7] ? null : data[6] !== 0);
      }
    }
    const rijen = [];
    for (let r = 0; r <= maxRij; r++) {
      const rijCellen = cellen.get(r);
      const rijUit = new Array(maxKol + 1).fill(null);
      if (rijCellen) for (const [k, v] of rijCellen) rijUit[k] = v;
      rijen.push(rijUit);
    }
    resultaat.push({ naam: blad.naam, rijen });
  }
  return { bladen: resultaat };
}

// Excel-serienummer (1900-systeem, zoals Excel voor Windows) -> "JJJJ-MM-DD". Aanvaardt ook al
// geschreven datums ("2025-12-10", "10/12/2025"). Geeft "" terug als het geen datum is.
export function excelDatumNaarIso(waarde) {
  if (typeof waarde === "number" && isFinite(waarde) && waarde > 0) {
    const ms = Math.round((waarde - 25569) * 86400000); // 25569 = 1970-01-01
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (typeof waarde === "string") {
    const t = waarde.trim();
    let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return "";
}
