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

const escHtml = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// kopregel met kantoornaam + adres, zichtbaar op elke pagina (inclusief het voorblad — Puppeteer/
// Chromium bieden geen ingebouwde manier om header/footer enkel op de eerste pagina te verbergen,
// dezelfde beperking die hieronder ook voor de voettekst geldt; bewust subtiel gehouden zodat dat
// op het voorblad niet stoort).
const buildHeaderTemplate = (adres) => `
  <div style="width:100%;font-family:Arial,sans-serif;font-size:8px;color:#8C6A2F;
    text-transform:uppercase;letter-spacing:0.6px;display:flex;justify-content:space-between;
    align-items:center;padding:0 16mm 4px 16mm;box-sizing:border-box;border-bottom:1px dotted #DDD8CA;">
    <span>Houpels Valuation &amp; Real Estate</span>
    <span style="text-transform:none;color:#4B5160;letter-spacing:0;">${escHtml(adres)}</span>
  </div>`;

const FOOTER_TEMPLATE = `
  <div style="width:100%;font-family:Arial,sans-serif;font-size:8.5px;color:#4B5160;
    display:flex;justify-content:space-between;align-items:center;padding:3px 16mm 0 16mm;
    box-sizing:border-box;border-top:1px dotted #DDD8CA;">
    <span>Houpels Valuation &amp; Real Estate</span>
    <span>Pagina <span class="pageNumber"></span> van <span class="totalPages"></span></span>
  </div>`;

async function renderPdf(page, html, headerTemplate) {
  await page.setContent(html, { waitUntil: "load" });
  return page.pdf({
    // format expliciet i.p.v. preferCSSPageSize: dat maakt de paginagrootte onafhankelijk van
    // hoe Chromium de @page-regel interpreteert — hetzelfde principe als bij de marge hierboven.
    format: "A4",
    printBackground: true,
    margin: MARGIN,
    displayHeaderFooter: true,
    headerTemplate,
    footerTemplate: FOOTER_TEMPLATE,
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Enkel POST toegelaten" });
  }

  const { html, adres } = req.body || {};
  if (!html || typeof html !== "string") {
    return res.status(400).json({ error: "Veld 'html' (tekst) is verplicht in de aanvraag" });
  }

  const headerTemplate = buildHeaderTemplate(adres);

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    // pass 1: enkel om op te meten op welke pagina elke TOCMARK_i-merker landt — zelfde marge/
    // kop/voettekst als pass 2, anders zou de paginering tussen beide passes kunnen verschillen
    const meetPdf = await renderPdf(page, html, headerTemplate);

    let finaleHtml = html;
    try {
      const paginas = await vindPaginasVanMerkers(meetPdf);
      finaleHtml = html.replace(/TOCPAGE_(\d+)/g, (heel, idx) => (idx in paginas ? String(paginas[idx]) : "—"));
      // de onzichtbare merkers zelf verwijderen we uit de definitieve PDF (anders blijven ze,
      // onzichtbaar maar aanwezig, opzoekbaar/kopieerbaar in de tekstlaag)
      finaleHtml = finaleHtml.replace(/\[\[TOCMARK:\d+\]\]/g, "");
    } catch (measureErr) {
      // meten mislukt — geen harde fout: de gebruiker krijgt dan een verder volledig correcte
      // PDF, enkel met "—" i.p.v. een paginanummer in de inhoudstafel
      console.error("Kon inhoudstafel-paginanummers niet opmeten:", measureErr);
      finaleHtml = html.replace(/TOCPAGE_(\d+)/g, "—").replace(/\[\[TOCMARK:\d+\]\]/g, "");
    }

    // pass 2: de definitieve PDF, nu met kloppende paginanummers in de inhoudstafel
    const pdfBuffer = await renderPdf(page, finaleHtml, headerTemplate);

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
    return res.end(bytes);
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error("PDF-generatie mislukt:", err);
    return res.status(500).json({ error: "Kon geen PDF genereren: " + err.message });
  }
}

// grotere HTML toelaten (rapporten met veel foto's als data-URL kunnen groot zijn)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
};
