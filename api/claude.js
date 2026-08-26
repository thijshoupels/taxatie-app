// ============================================================================
// VEILIGE AI-TUSSENLAAG voor de taxatie-app
// ============================================================================
// Vercel herkent dit automatisch als een serverless endpoint, bereikbaar op
// /api/claude.
//
// WAAROM DIT NODIG IS:
// De huidige app roept https://api.anthropic.com rechtstreeks aan vanuit de
// browser, zonder API-sleutel — dat werkt enkel omdat Claude.ai dat zelf
// afhandelt. Buiten Claude.ai heb je een ECHTE Anthropic API-sleutel nodig,
// en die mag NOOIT in de broncode van de website staan (iedereen die de
// pagina bekijkt zou hem dan kunnen stelen en op jouw kosten gebruiken).
// Deze functie draait op de server, houdt de sleutel geheim (via een
// omgevingsvariabele), en stuurt de aanvraag door naar Anthropic.
//
// BELANGRIJK — Vercel's vaste 4,5MB-limiet per aanvraag:
// Elke Vercel serverless functie weigert INKOMENDE aanvragen boven 4,5MB
// (FUNCTION_PAYLOAD_TOO_LARGE) — dat is een platformlimiet, niet aanpasbaar
// via "bodyParser.sizeLimit" hieronder (die instelling regelt enkel hoeveel
// Next.js zelf wil inlezen, niet wat Vercel er al vóór laat passeren).
// Een base64-gecodeerd PDF-document overschrijdt die 4,5MB al snel.
//
// Daarom ondersteunt deze functie twee manieren om ze aan te roepen:
//   1. { model, max_tokens, messages, tools } — het gewone pad, voor korte
//      tekstaanvragen (bv. het SWOT-voorstel) zonder bijlagen.
//   2. { model, max_tokens, documentUrls, promptText } — voor documentanalyse:
//      de frontend laadt het document eerst op naar Supabase Storage en stuurt
//      hier enkel een kortlevende signed URL naartoe. Deze functie haalt het
//      bestand daar zelf op (een UITGAANDE fetch vanuit de functie valt niet
//      onder diezelfde 4,5MB-limiet) en zet het pas hier om naar base64 voor
//      Anthropic.
// ============================================================================

const MAX_DOC_BYTES = 30 * 1024 * 1024; // ruime marge; ver onder Anthropic's eigen limiet per document

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Enkel POST toegelaten" } });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: "ANTHROPIC_API_KEY ontbreekt op de server" } });
  }

  const { model, max_tokens, tools, documentUrls, promptText } = req.body || {};
  let { messages } = req.body || {};

  if (documentUrls && documentUrls.length) {
    const docBlocks = [];
    for (const doc of documentUrls) {
      let response;
      try {
        response = await fetch(doc.url);
      } catch (err) {
        return res.status(502).json({ error: { message: `Kon document niet ophalen: ${err.message}` } });
      }
      if (!response.ok) {
        return res.status(502).json({ error: { message: `Kon document niet ophalen (status ${response.status})` } });
      }
      const buf = await response.arrayBuffer();
      if (buf.byteLength > MAX_DOC_BYTES) {
        return res.status(413).json({ error: { message: "Document is te groot voor AI-analyse (max. 30MB)." } });
      }
      docBlocks.push({
        type: "document",
        source: { type: "base64", media_type: doc.mediaType || "application/pdf", data: Buffer.from(buf).toString("base64") },
      });
    }
    messages = [{ role: "user", content: [...docBlocks, { type: "text", text: promptText || "" }] }];
  }

  if (!model || !messages) {
    return res.status(400).json({ error: { message: "model en messages (of documentUrls) zijn verplicht" } });
  }

  // eenvoudige bescherming tegen misbruik: begrens max_tokens server-side,
  // ongeacht wat de client vraagt
  const safeMaxTokens = Math.min(Number(max_tokens) || 1024, 4096);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: safeMaxTokens,
        messages,
        ...(tools ? { tools } : {}),
      }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: { message: "Kon Anthropic niet bereiken: " + err.message } });
  }
}

// De inkomende aanvraag bevat voortaan enkel nog korte tekst of een signed URL
// (nooit meer het volledige document), dus een kleine limiet volstaat ruim.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};
