// ============================================================================
// SERVER-SIDE PDF-GENERATIE voor de taxatie-app
// ============================================================================
// Plaats dit bestand in /api/generate-pdf.js in je Vercel-project.
//
// WAAROM DIT NODIG IS EN HOE HET WERKT:
// Binnen een pure browseromgeving (zonder server, zoals de vroegere Claude.ai-
// weergave) bestaat er geen manier om een gebruiker een PDF-bestand rechtstreeks
// te laten downloaden die GEGARANDEERD dezelfde lay-out heeft als de HTML — de
// enige browser-eigen weg daarvoor is het printvenster ("Opslaan als PDF"), wat
// een extra handeling van de gebruiker vraagt.
//
// Deze functie lost dat op door de identieke HTML die de app toch al bouwt (via
// buildPrintHtml) hier op de server te laten renderen door een echte, onzichtbare
// Chrome-browser (headless Chromium) en die te laten "afdrukken" naar PDF —
// dezelfde weergave-engine, dus dezelfde lay-out, automatisch en zonder
// tussenstap voor de gebruiker.
//
// TWEE RENDER-PASSES, WAAROM:
// De HTML vloeit natuurlijk door (elke sectie kondigt wel een eigen pagina aan
// via CSS break-before, maar hoeveel pagina's ze daadwerkelijk in beslag neemt
// hangt af van de inhoud), dus vooraf, in de browser-app, is niet met zekerheid
// te zeggen op welke fysieke pagina een sectie zal belanden. Om de inhoudstafel
// toch exacte paginanummers te kunnen geven:
//   1. Eerste render: de HTML bevat onzichtbare tekstmerkers ([[TOCMARK:0]], [[TOCMARK:1]], ...)
//      vlak vóór elk onderdeel dat in de inhoudstafel staat. Deze PDF wordt NOOIT
//      teruggestuurd naar de gebruiker, enkel gebruikt om op te meten.
//   2. Deze PDF wordt uitgelezen (zie vindPaginasVanMerkers hieronder): op welke
//      paginaindex staat elke merker? Dat geeft een exacte {merker → paginanummer}.
//   3. Diezelfde HTML wordt herbouwd met de TOCPAGE_i-plaatshoudertjes in de
//      inhoudstafel vervangen door die echte nummers, en opnieuw gerenderd — dít
//      is de PDF die de gebruiker binnenkrijgt.
//
// TEKST UITLEZEN VAN DE MEET-PDF — "unpdf", NIET "pdfjs-dist" RECHTSTREEKS:
// Een eerdere versie gebruikte het pakket "pdfjs-dist" rechtstreeks. Dat pakket
// is in essentie gebouwd voor de BROWSER en verwacht een aparte "worker"-bestand
// dat apart geladen wordt — in een Vercel-serverless-functie wordt dat
// worker-bestand niet automatisch meegebundeld, waardoor het uitlezen van de
// meet-PDF op de server stil faalde (de inhoudstafel toonde daardoor overal "—"
// in plaats van een paginanummer, zonder zichtbare fout voor de gebruiker). Het
// pakket "unpdf" bevat een eigen, voor serverless/edge-omgevingen aangepaste
// build van PDF.js waarbij die worker rechtstreeks in de hoofdbundel is verwerkt
// (geen apart bestand nodig) — daarom hier gebruikt in plaats van "pdfjs-dist".
//
// MARGES EN PAGINANUMMERS:
// De HTML zelf zet geen @page-marge (enkel het papierformaat) — de fysieke marge
// (page.pdf({margin})) én de kop-/voettekst (headerTemplate/footerTemplate, met
// Puppeteers eigen <span class="pageNumber"> / <span class="totalPages">) worden
// hieronder door Puppeteer zelf toegepast op de uiteindelijke, écht gerenderde
// pagina's. LET OP: een @page-marge (zelfs @page{margin:0}) in de HTML/CSS zet in
// deze Chromium-versie Puppeteer's eigen marge-optie stilzwijgend buiten werking
// — vandaar dat de HTML-kant daar bewust geen margin-eigenschap meer op zet.
//
// BENODIGDE PAKKETTEN:
//   npm install puppeteer-core @sparticuz/chromium unpdf
//   npm install --save-dev puppeteer   (enkel nodig om LOKAAL te testen)
//
// BELANGRIJK — versie van @sparticuz/chromium moet passen bij de Node.js-runtime
// die Vercel gebruikt: dit pakket bevat een kant-en-klaar gecompileerde Chromium
// voor een specifieke onderliggende Lambda-runtime-image. Een te oude pakketversie
// op een nieuwere Node.js-runtime (of omgekeerd) geeft de fout "error while
// loading shared libraries: libnss3.so: cannot open shared object file" bij het
// opstarten van de browser. package.json zet daarom zowel de pakketversie
// (^149.0.0) als "engines.node": "24.x" vast, zodat ze gegarandeerd samen passen.
//
// TIJDSLIMIET:
// Twee render-passes duren logischerwijze langer dan één — zet in vercel.json de
// maximale looptijd van deze functie op minstens 60 seconden.
// ============================================================================

import chromium from "@sparticuz/chromium";

// fysieke paginamarge — enkel hier aanpassen, wordt hieronder consequent gebruikt
// (top/bottom iets ruimer zodat de kop-/voettekst comfortabel past)
const MARGIN = { top: "20mm", bottom: "22mm", left: "16mm", right: "16mm" };

async function launchBrowser() {
  const isLocal = !process.env.VERCEL_ENV;
  const puppeteer = isLocal ? await import("puppeteer") : await import("puppeteer-core");
  const browser = await puppeteer.launch(
    isLocal
      ? { headless: true }
      : {
          // exacte, huidige aanroep zoals gedocumenteerd door @sparticuz/chromium zelf voor
          // deze pakketversie — chromium.args alleen (zoals in oudere versies) volstaat niet
          // meer, puppeteer.defaultArgs() moet de headless-modus expliciet meekrijgen.
          args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
          defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false, isLandscape: true },
          executablePath: await chromium.executablePath(),
          headless: "shell",
        }
  );
  return browser;
}

// Let op de aanhalingstekens: deze waarden komen in een ATTRIBUUT terecht (style="...color:${...}"),
// dus zonder " en ' te ontsnappen kan een waarde uit het attribuut breken en eigen markup in de
// kop-/voettekst injecteren. Vandaar dat beide hier wél mee ontsnapt worden.
const escHtml = (v) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// standaard huisstijl — gebruikt wanneer de aanvraag geen "huisstijl" meestuurt (bv. een oudere
// versie van de app), zodat de kop-/voettekst nooit leeg kunnen blijven.
const STANDAARD_HUISSTIJL = { naam: "Houpels Valuation & Real Estate", kleur: "#8C6A2F" };

// kopregel met kantoornaam + adres, zichtbaar op elke pagina (inclusief het voorblad — Puppeteer/
// Chromium bieden geen ingebouwde manier om de header enkel op de eerste pagina te verbergen;
// bewust subtiel gehouden zodat dat op het voorblad niet stoort). "huisstijl" ({naam, kleur}) komt
// van de client mee — welke huisstijl (Houpels of Huyzen Vastgoed, zie kiesHuisstijl in App.jsx)
// van toepassing is, hangt af van de ingelogde gebruiker, niet van iets dat de server zelf kan
// afleiden.
const buildHeaderTemplate = (adres, huisstijl) => `
  <div style="width:100%;font-family:Arial,sans-serif;font-size:8px;color:${escHtml(huisstijl.kleur)};
    text-transform:uppercase;letter-spacing:0.6px;display:flex;justify-content:space-between;
    align-items:center;padding:0 16mm 4px 16mm;box-sizing:border-box;border-bottom:1px dotted #DDD8CA;">
    <span>${escHtml(huisstijl.naam)}</span>
    <span style="text-transform:none;color:#4B5160;letter-spacing:0;">${escHtml(adres)}</span>
  </div>`;

// De voettekst mag op het voorblad zelf géén paginanummer tonen, en het voorblad mag niet
// meetellen in "Pagina X van Y" op de andere pagina's — het voorblad is voor de lezer geen
// "pagina" van het verslag. Puppeteer/Chromium vullen ".pageNumber"/".totalPages" zelf in met het
// écht gerenderde paginanummer van de VOLLEDIGE PDF (voorblad inbegrepen als fysieke pagina 1) —
// er bestaat geen ingebouwde optie om dat al bij het tellen te corrigeren. Het onderstaande
// <script> (dat, net als de rest van deze template, in Chromium's eigen voettekst-frame per
// pagina wordt uitgevoerd — een bekend en veelgebruikt patroon voor dit exacte probleem) corrigeert
// dat ná het invullen: op fysieke pagina 1 (= het voorblad) wordt de hele voettekst verborgen; op
// elke andere pagina worden zowel het getoonde paginanummer als het totaal met 1 verminderd, zodat
// de zichtbare nummering pas na het voorblad bij 1 begint.
const buildFooterTemplate = (huisstijl) => `
  <div class="pdf-footer" style="width:100%;font-family:Arial,sans-serif;font-size:8.5px;color:#4B5160;
    display:flex;justify-content:space-between;align-items:center;padding:3px 16mm 0 16mm;
    box-sizing:border-box;border-top:1px dotted #DDD8CA;">
    <span>${escHtml(huisstijl.naam)}</span>
    <span>Pagina <span class="pageNumber"></span> van <span class="totalPages"></span></span>
  </div>
  <script>
    (function () {
      var pageEl = document.querySelector(".pageNumber");
      var totalEl = document.querySelector(".totalPages");
      var footer = document.querySelector(".pdf-footer");
      if (!pageEl || !totalEl || !footer) return;
      var page = parseInt(pageEl.textContent, 10);
      var total = parseInt(totalEl.textContent, 10);
      if (!page || !total) return;
      if (page === 1) {
        footer.style.display = "none";
      } else {
        pageEl.textContent = String(page - 1);
        totalEl.textContent = String(total - 1);
      }
    })();
  </script>`;

// Welke adressen de renderende Chromium mag ophalen. De HTML komt uit de browser van de gebruiker,
// dus zonder deze afscherming kan een aanvraag de server elk willekeurig adres laten bevragen
// (extern én intern) en de opgehaalde inhoud zichtbaar terugkrijgen in de PDF. Het verslag zelf
// heeft enkel de eigen Supabase-opslag (ondertekende fotolinks) en de Google-kaart nodig; al het
// overige beeldmateriaal zit als data:-URI in de HTML.
function magOphalen(url) {
  if (/^data:/i.test(url) || /^about:blank/i.test(url)) return true;
  let origin;
  try { origin = new URL(url).origin; } catch { return false; }
  const toegelaten = ["https://maps.googleapis.com", "https://maps.gstatic.com"];
  try { toegelaten.push(new URL(process.env.VITE_SUPABASE_URL).origin); } catch { /* niet ingesteld */ }
  return toegelaten.includes(origin);
}

async function beveiligPagina(page) {
  // JavaScript is niet nodig voor het verslag: alle inhoud staat in de HTML zelf. (Het script in de
  // voettekst draait in Chromium's eigen kop-/voettekstframe en blijft dus gewoon werken.)
  await page.setJavaScriptEnabled(false);
  await page.setRequestInterception(true);
  page.on("request", (verzoek) => {
    if (magOphalen(verzoek.url())) verzoek.continue().catch(() => {});
    else verzoek.abort().catch(() => {});
  });
}

async function renderPdf(page, html, headerTemplate, footerTemplate) {
  await page.setContent(html, { waitUntil: "load" });
  return page.pdf({
    // format expliciet i.p.v. preferCSSPageSize: dat maakt de paginagrootte onafhankelijk van
    // hoe Chromium de @page-regel interpreteert — hetzelfde principe als bij de marge hierboven.
    format: "A4",
    printBackground: true,
    margin: MARGIN,
    displayHeaderFooter: true,
    headerTemplate,
    footerTemplate,
  });
}

// zoekt in de (nooit teruggestuurde) meet-PDF op welke pagina-index (1-based) elke
// TOCMARK_i-tekstmerker staat, via "unpdf" (pure tekstextractie, serverless-veilig — zie
// toelichting bovenaan dit bestand).
async function vindPaginasVanMerkers(pdfBuffer) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
  const { text } = await extractText(pdf, { mergePages: false });
  const gevonden = {};
  text.forEach((paginaTekst, idx0) => {
    const paginaNummer = idx0 + 1;
    // "[[TOCMARK:i]]" i.p.v. "TOCMARK_i": de afsluitende "]]" bakent het nummer ondubbelzinnig af,
    // ook als deze merker in de tekstlaag toevallig direct aan het volgende teken plakt (bv. een
    // sectietitel die met een cijfer begint) — zie de toelichting bij tocMark() in App.jsx.
    const matches = paginaTekst.matchAll(/\[\[TOCMARK:(\d+)\]\]/g);
    for (const m of matches) {
      const idx = m[1];
      if (!(idx in gevonden)) gevonden[idx] = paginaNummer; // eerste (=bovenste) voorkomen op deze pagina telt
    }
  });
  return gevonden;
}

// ----------------------------------------------------------------------------
// AUTHENTICATIE — het renderen van een PDF start een echte, zware headless-
// Chromium-browser op; zonder controle kan om het even wie (buiten de app om)
// deze functie herhaaldelijk aanroepen en zo onbeperkt serverkosten veroorzaken,
// of een PDF laten genereren met een willekeurige huisstijl/merknaam. We
// valideren hier het Supabase-sessietoken dat de frontend meestuurt — zelfde
// aanpak, en dezelfde publieke project-URL/anon-key, als in api/claude.js.
// ----------------------------------------------------------------------------
async function verifieerGebruiker(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !supabaseAnonKey) return null;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Enkel POST toegelaten" });
  }

  const gebruiker = await verifieerGebruiker(req);
  if (!gebruiker) {
    return res.status(401).json({ error: "Niet aangemeld — log opnieuw in en probeer het nogmaals." });
  }

  const { html, adres, huisstijl } = req.body || {};
  if (!html || typeof html !== "string") {
    return res.status(400).json({ error: "Veld 'html' (tekst) is verplicht in de aanvraag" });
  }
  // bovengrens op de omvang: Vercel weigert een aanvraag boven 4,5MB toch al, maar een expliciete
  // grens hier voorkomt dat een extreem grote HTML de renderer minutenlang bezig houdt
  if (html.length > 4 * 1024 * 1024) {
    return res.status(413).json({ error: "Het verslag is te groot om op de server om te zetten." });
  }
  // kleur en naam komen uit de aanvraag en belanden in een attribuut van de kop-/voettekst —
  // naast het ontsnappen in escHtml hier ook nog eens qua vorm begrensd
  if (huisstijl && huisstijl.kleur && !/^#[0-9a-f]{3,8}$/i.test(String(huisstijl.kleur))) {
    return res.status(400).json({ error: "Ongeldige huisstijlkleur." });
  }

  // "huisstijl" ({naam, kleur}) — zie STANDAARD_HUISSTIJL hierboven voor de terugvalwaarde
  const hs = (huisstijl && huisstijl.naam && huisstijl.kleur) ? huisstijl : STANDAARD_HUISSTIJL;
  const headerTemplate = buildHeaderTemplate(adres, hs);
  const footerTemplate = buildFooterTemplate(hs);

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await beveiligPagina(page); // netwerkfilter + JS uit — zie magOphalen hierboven

    // pass 1: enkel om op te meten op welke pagina elke TOCMARK_i-merker landt — zelfde marge/
    // kop/voettekst als pass 2, anders zou de paginering tussen beide passes kunnen verschillen
    const meetPdf = await renderPdf(page, html, headerTemplate, footerTemplate);

    let finaleHtml = html;
    // wordt hieronder op false gezet als het meten mislukt — de frontend krijgt dit terug via de
    // "X-Toc-Meting-Ok"-header (zie verderop) en toont dan een zichtbare waarschuwing i.p.v. dit
    // stil te laten passeren, want dit document kan wettelijk relevant zijn (Vlabel/nalatenschap)
    // met dan een ongemerkt lege inhoudstafel (zie audit, punt H3).
    let tocMetingOk = true;
    try {
      const paginas = await vindPaginasVanMerkers(meetPdf);
      // "-1": vindPaginasVanMerkers geeft het fysieke paginanummer terug (voorblad meegeteld als
      // fysieke pagina 1) — de inhoudstafel moet, net als de voettekst hierboven, tonen alsof het
      // voorblad geen pagina is, dus wordt hier dezelfde correctie toegepast.
      finaleHtml = html.replace(/TOCPAGE_(\d+)/g, (heel, idx) => (idx in paginas ? String(paginas[idx] - 1) : "—"));
      // de onzichtbare merkers zelf verwijderen we uit de definitieve PDF (anders blijven ze,
      // onzichtbaar maar aanwezig, opzoekbaar/kopieerbaar in de tekstlaag)
      finaleHtml = finaleHtml.replace(/\[\[TOCMARK:\d+\]\]/g, "");
    } catch (measureErr) {
      // meten mislukt — geen harde fout: de gebruiker krijgt dan een verder volledig correcte
      // PDF, enkel met "—" i.p.v. een paginanummer in de inhoudstafel
      console.error("Kon inhoudstafel-paginanummers niet opmeten:", measureErr);
      finaleHtml = html.replace(/TOCPAGE_(\d+)/g, "—").replace(/\[\[TOCMARK:\d+\]\]/g, "");
      tocMetingOk = false;
    }

    // pass 2: de definitieve PDF, nu met kloppende paginanummers in de inhoudstafel
    const pdfBuffer = await renderPdf(page, finaleHtml, headerTemplate, footerTemplate);

    await browser.close();

    // Belangrijk: res.send()/res.json() interpreteren de body soms als tekst, wat een binair
    // PDF-bestand corrumpeert (bytes die geen geldige UTF-8-tekens zijn, worden dan stilzwijgend
    // vervangen — het bestand opent dan niet meer). res.end() op het onderliggende
    // Node-antwoordobject schrijft een Buffer altijd byte-voor-byte weg, zonder tekstinterpretatie.
    const bytes = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="taxatieverslag.pdf"');
    res.setHeader("Content-Length", bytes.length);
    // laat de frontend weten of de paginanummering in de inhoudstafel wel/niet betrouwbaar kon
    // worden opgemeten (zie tocMetingOk hierboven) — een custom header, want de PDF zelf is hier
    // het volledige antwoordbody (geen ruimte voor extra JSON-velden erbij).
    res.setHeader("X-Toc-Meting-Ok", tocMetingOk ? "1" : "0");
    return res.end(bytes);
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error("PDF-generatie mislukt:", err);
    return res.status(500).json({ error: "Kon geen PDF genereren: " + err.message });
  }
}

// LET OP: dit bestand is een gewone Vercel-serverless-functie (geen Next.js) — een
// "export const config = { api: { bodyParser: { sizeLimit } } }" zoals hierboven ooit stond is
// een Next.js-specifieke conventie die hier GEEN enkel effect heeft. Vercel hanteert voor elke
// serverless-functie (Node.js-runtime) een vaste, niet-configureerbare aanvraaglimiet van 4,5MB
// — die grens kan niet via code verhoogd worden. Bij een dossier met veel/grote foto's kan de
// meegestuurde HTML (met alle foto's als base64 erin) die grens overschrijden, wat hier faalt
// vóór deze functie zelfs maar start (status 413, FUNCTION_PAYLOAD_TOO_LARGE) — dus zonder dat
// er hier iets te loggen valt. De client (handlePrintPdf in App.jsx) omzeilt dit voortaan door
// grote foto's eerst tijdelijk naar Supabase Storage op te laden en enkel de link mee te sturen
// in plaats van de volledige base64-data, zodra de opgebouwde HTML de 3,5MB nadert — zie
// uploadFotoVoorPdf in App.jsx.
