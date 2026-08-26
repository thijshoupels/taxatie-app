// ============================================================================
// SERVER-SIDE PDF-GENERATIE voor de taxatie-app
// ============================================================================
// Plaats dit bestand in /api/generate-pdf.js in je Vercel-project.
//
// WAAROM DIT NODIG IS EN HOE HET WERKT:
// Binnen een pure browseromgeving (zonder server, zoals de huidige Claude.ai-
// weergave) bestaat er geen manier om een gebruiker een PDF-bestand rechtstreeks
// te laten downloaden die GEGARANDEERD 100% dezelfde lay-out heeft als de HTML
// — de enige browser-eigen weg daarvoor is het printvenster ("Opslaan als
// PDF"), wat een extra handeling van de gebruiker vraagt.
//
// Deze functie lost dat op door de identieke HTML die de app toch al bouwt
// (via buildPrintHtml) hier op de server te laten renderen door een echte,
// onzichtbare Chrome-browser (headless Chromium) en die vervolgens te laten
// "afdrukken" naar PDF — exact dezelfde weergave-engine, dus exact dezelfde
// lay-out, alleen automatisch en zonder tussenstap voor de gebruiker.
//
// Dit is de gangbare, in de praktijk bewezen aanpak voor "PDF-downloadknoppen"
// bij webapps (bevestigd via actuele bronnen, medio 2026) — geen experimentele
// techniek.
//
// BENODIGDE PAKKETTEN:
//   npm install puppeteer-core @sparticuz/chromium
//   npm install --save-dev puppeteer   (enkel nodig om LOKAAL te testen)
//
// BELANGRIJK — versie van @sparticuz/chromium moet passen bij de Node.js-runtime
// die Vercel gebruikt: dit pakket bevat een kant-en-klaar gecompileerde Chromium
// voor een specifieke onderliggende Lambda-runtime-image. Een te oude pakketversie
// op een nieuwere Node.js-runtime (of omgekeerd) geeft precies de fout "error while
// loading shared libraries: libnss3.so: cannot open shared object file" bij het
// opstarten van de browser. package.json zet daarom zowel de pakketversie
// (^149.0.0) als "engines.node": "24.x" vast, zodat ze gegarandeerd samen passen.
//
// TIJDSLIMIET:
// Zet in je Vercel-projectinstellingen (of in vercel.json) de maximale
// looptijd van deze functie op minstens 30 seconden — het opstarten van de
// browser kost enkele seconden.
// ============================================================================

import chromium from "@sparticuz/chromium";

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
    // lokaal (op de laptop van een developer, tijdens ontwikkeling) gebruiken we
    // de gewone "puppeteer" met een meegeleverde Chromium; op Vercel gebruiken we
    // de voor serverless geoptimaliseerde "@sparticuz/chromium".
    const isLocal = !process.env.VERCEL_ENV;
    const puppeteer = isLocal ? await import("puppeteer") : await import("puppeteer-core");

    browser = await puppeteer.launch(
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

    const page = await browser.newPage();

    // de HTML bevat alles inline (stijlen, afbeeldingen als data-URL) — er moet
    // dus niets extern opgehaald worden, wat dit zowel snel als betrouwbaar maakt.
    await page.setContent(html, { waitUntil: "load" });

    // preferCSSPageSize: true zorgt ervoor dat Chromium de @page-regel uit de
    // meegegeven HTML zelf volgt (A4, 20mm marge) in plaats van eigen
    // standaardwaarden op te leggen — dat garandeert de 100%-identieke lay-out.
    const pdfBuffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    });

    await browser.close();

    // Belangrijk: res.send()/res.json() interpreteren de body soms als tekst, wat een
    // binair PDF-bestand corrumpeert (bytes die geen geldige UTF-8-tekens zijn, worden
    // dan stilzwijgend vervangen — het bestand opent dan niet meer). res.end() op het
    // onderliggende Node-antwoordobject schrijft een Buffer altijd byte-voor-byte weg,
    // zonder enige tekstinterpretatie, en is dus de veilige weg voor binaire bestanden.
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
