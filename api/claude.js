// ============================================================================
// VEILIGE AI-TUSSENLAAG voor de taxatie-app
// ============================================================================
// Plaats dit bestand in /api/claude.js in je Vercel-project (of de gelijkaardige
// map bij Netlify Functions — zie README). Vercel/Netlify herkennen dit
// automatisch als een serverless endpoint, bereikbaar op /api/claude.
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
// INSTELLEN:
// 1. Maak een API-sleutel aan op https://console.anthropic.com
// 2. Zet ze als omgevingsvariabele ANTHROPIC_API_KEY in je Vercel/Netlify-
//    projectinstellingen (nooit in de code zelf!)
// 3. In de frontend (taxatie_app.jsx) vervang je alle aanroepen naar
//    "https://api.anthropic.com/v1/messages" door "/api/claude" — zie
//    frontend-storage-supabase.js voor een voorbeeld van dat patroon.
// ============================================================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Enkel POST toegelaten" } });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: "ANTHROPIC_API_KEY ontbreekt op de server" } });
  }

  // de frontend stuurt exact hetzelfde soort body als voorheen rechtstreeks
  // naar Anthropic (model, max_tokens, messages, eventueel tools) — wij
  // voegen enkel de geheime sleutel toe en sturen door.
  const { model, max_tokens, messages, tools } = req.body || {};

  if (!model || !messages) {
    return res.status(400).json({ error: { message: "model en messages zijn verplicht" } });
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

// Vercel-specifiek: verhoog de standaard body-groottelimiet, want een
// PDF-document (base64) kan groter zijn dan de standaard 1MB.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "15mb",
    },
  },
};
