// De volledige Chrome van "puppeteer" is enkel nodig om lokaal PDF's te testen (zie
// api/generate-pdf.js). Op Vercel en GitHub wordt de download overgeslagen: dat spaart bij elke
// build zo'n 150 MB aan downloadtijd. De echte PDF-functie gebruikt @sparticuz/chromium.
module.exports = { skipDownload: !!(process.env.VERCEL || process.env.CI) };
