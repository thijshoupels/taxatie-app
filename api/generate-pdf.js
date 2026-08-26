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
// De HTML vloeit nu natuurlijk door (geen vaste "1 sectie = 1 pagina" meer), dus
// vooraf, in de browser-app, is niet met zekerheid te zeggen op welke fysieke
// pagina een sectie zal belanden — dat hangt af van hoe Chromium uiteindelijk
// echt paginietert. Om de inhoudstafel toch exacte paginanummers te kunnen geven:
//   1. Eerste render: de HTML bevat onzichtbare tekstmerkers (TOCMARK_0, _1, ...)
//      vlak vóór elk onderdeel dat in de inhoudstafel staat. Deze PDF wordt NOOIT
//      teruggestuurd naar de gebruiker, enkel gebruikt om op te meten.
//   2. Deze PDF wordt met pdfjs-dist per pagina uitgelezen: op welke paginaindex
//      staat elke merker? Dat geeft een exacte {merker → paginanummer}-koppeling.
//   3. Diezelfde HTML wordt herbouwd met de TOCPAGE_i-plaatshoudertjes in de
//      inhoudstafel vervangen door die echte nummers, en opnieuw gerenderd — dít
//      is de PDF die de gebruiker binnenkrijgt.
//
// MARGES EN PAGINANUMMERS:
// De HTML zelf zet @page-marge op 0 en bevat geen eigen voettekst meer — de
// fysieke marge (page.pdf({margin})) én de voettekst met paginanummer
// (headerTemplate/footerTemplate, met Puppeteers eigen <span class="pageNumber">
// / <span class="totalPages">) worden hieronder door Puppeteer zelf toegepast op
// de uiteindelijke, écht gerenderde pagina's. Dat is de betrouwbare weg bij
// headless Chromium: CSS @page-marges worden daar niet consistent gerespecteerd,
// maar de eigen margin-optie van Puppeteer wel, en de kop-/voetteksten daarvan
// kloppen per definitie met de werkelijke paginering, wat er ook natuurlijk op
// elke pagina past.
//
// BENODIGDE PAKKETTEN:
//   npm install puppeteer-core @sparticuz/chromium pdfjs-dist
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
// (top/bottom iets ruimer zodat de voettekst comfortabel past)
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

const FOOTER_TEMPLATE = `
  <div style="width:100%;font-family:Arial,sans-serif;font-size:8.5px;color:#4B5160;
    display:flex;justify-content:space-between;align-items:center;padding:3px 16mm 0 16mm;
    box-sizing:border-box;border-top:1px dotted #DDD8CA;">
    <span>Houpels Valuation &amp; Real Estate</span>
    <span>Pagina <span class="pageNumber"></span> van <span class="totalPages"></span></span>
  </div>`;

async function renderPdf(page, html) {
  await page.setContent(html, { waitUntil: "load" });
  return page.pdf({
    // format expliciet i.p.v. preferCSSPageSize: dat maakt de paginagrootte onafhankelijk van
    // hoe Chromium de @page-regel interpreteert — hetzelfde principe als bij de marge hierboven.
    format: "A4",
    printBackground: true,
    margin: MARGIN,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: FOOTER_TEMPLATE,
  });
}

// zoekt in de (nooit teruggestuurde) meet-PDF op welke pagina-index (0-based) elke
// TOCMARK_i-tekstmerker staat, via pdfjs-dist (zuivere tekstextractie, geen rendering nodig)
async function vindPaginasVanMerkers(pdfBuffer) {
  const pdfjs = await import("pdfjs-dist");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  const gevonden = {};
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const tekst = content.items.map((it) => it.str || "").join("");
    const matches = tekst.matchAll(/TOCMARK_(\d+)/g);
    for (const m of matches) {
      const idx = m[1];
      if (!(idx in gevonden)) gevonden[idx] = i; // eerste (=bovenste) voorkomen op deze pagina telt
    }
  }
  return gevonden;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Enkel POST toegelaten" });
  }

  const { html } = req.body || {};
  if (!html || typeof html !== "string") {
    return res.status(400).json({ error: "Veld 'html' (tekst) is verplicht in de aanvraag" });
  }

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    // pass 1: enkel om op te meten op welke pagina elke TOCMARK_i-merker landt
    const meetPdf = await renderPdf(page, html);

    let finaleHtml = html;
    try {
      const paginas = await vindPaginasVanMerkers(meetPdf);
      finaleHtml = html.replace(/TOCPAGE_(\d+)/g, (heel, idx) => (idx in paginas ? String(paginas[idx]) : "—"));
      // de onzichtbare merkers zelf verwijderen we uit de definitieve PDF (anders blijven ze,
      // onzichtbaar maar aanwezig, opzoekbaar/kopieerbaar in de tekstlaag)
      finaleHtml = finaleHtml.replace(/TOCMARK_\d+/g, "");
    } catch (measureErr) {
      // meten mislukt (bv. pdfjs-dist-probleem) — geen harde fout: de gebruiker krijgt dan een
      // verder volledig correcte PDF, enkel met "—" i.p.v. een paginanummer in de inhoudstafel
      console.error("Kon inhoudstafel-paginanummers niet opmeten:", measureErr);
      finaleHtml = html.replace(/TOCPAGE_(\d+)/g, "—").replace(/TOCMARK_\d+/g, "");
    }

    // pass 2: de definitieve PDF, nu met kloppende paginanummers in de inhoudstafel
    const pdfBuffer = await renderPdf(page, finaleHtml);

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
