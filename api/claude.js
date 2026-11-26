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
// Alles wat de browser mag vragen, staat hier vast — zie de toelichting bij het gebruik hieronder.
const TOEGELATEN_MODELLEN = ["claude-haiku-4-5-20251001", "claude-sonnet-4-6"];
const TOEGELATEN_TOOLS = ["web_search_20250305"];
// Kostenrem op het internetzoeken: elke zoekopdracht kost apart (US$ 10 per 1000) en de gevonden
// pagina's worden daarna als invoertokens aangerekend. Zonder grens deed de omgevingsanalyse
// (StepLigging) gemiddeld zo'n 7 zoekopdrachten per aanvraag — goed voor het grootste deel van
// de Anthropic-kosten. Server-side vastgezet, net zoals max_tokens hieronder.
const MAX_WEBZOEKOPDRACHTEN = 5;
// Labels voor de verbruikslog (tabel ai_verbruik, zie supabase/ai-verbruik.sql): welke functie in
// de app de aanroep deed. Enkel deze waarden worden bewaard, al de rest wordt "onbekend".
const TOEGELATEN_FUNCTIES = ["ligging", "documenten", "swot", "conclusie", "motivering", "tekst"];
// Catalogusprijzen in USD per miljoen tokens, excl. btw — enkel voor de GESCHATTE kost in de
// verbruikslog; de echte factuur blijft die van de Anthropic Console. Cache schrijven kost 1,25×
// en cache lezen 0,1× de invoerprijs; een webzoekopdracht kost US$ 10 per 1000.
const PRIJZEN = {
  "claude-sonnet-4-6": { invoer: 3, uitvoer: 15 },
  "claude-haiku-4-5-20251001": { invoer: 1, uitvoer: 5 },
};
const PRIJS_PER_ZOEKOPDRACHT = 0.01;
const MAX_DOCUMENTEN = 5;      // per aanvraag (Anthropic telt sowieso max. 100 pagina's samen)
const MAX_TOTAAL_BYTES = 40 * 1024 * 1024; // over alle documenten van één aanvraag samen
const MAX_AI_PER_UUR = 40;     // per gebruiker
const UUR_MS = 60 * 60 * 1000;
const _verbruik = new Map();   // gebruiker-id -> { tot, aantal }

// ----------------------------------------------------------------------------
// AUTHENTICATIE — deze functie roept een betaalde AI-dienst aan en mag dus niet
// door om het even wie (buiten de app om, bv. met curl) aan te roepen zijn.
// We valideren hier het Supabase-sessietoken dat de frontend meestuurt via de
// gewone Authorization-header — GEEN nieuwe/geheime sleutel nodig: dit gebeurt
// met dezelfde publieke project-URL/anon-key als de frontend zelf gebruikt,
// Supabase's eigen Auth-server verifieert het token en levert de bijhorende
// gebruiker terug (of een fout als het token ongeldig/verlopen/onbestaand is).
// ----------------------------------------------------------------------------
function haalToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

async function verifieerGebruiker(req) {
  const token = haalToken(req);
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

// ----------------------------------------------------------------------------
// VERBRUIKSLOG PER ACCOUNT — de Anthropic Console ziet enkel de ene API-sleutel van de app, niet
// welke gebruiker het verbruik veroorzaakt. Daarom schrijven we na elke geslaagde aanroep één rij
// weg in ai_verbruik, met het sessietoken van de gebruiker zelf (de toegangsregel laat enkel een
// rij voor jezelf toe — geen geheime service-sleutel nodig). Een mislukte logregel (bv. de tabel
// bestaat nog niet) mag het AI-antwoord NOOIT tegenhouden: enkel een melding in de Vercel-logs.
// ----------------------------------------------------------------------------
export function berekenKosten(model, usage) {
  const p = PRIJZEN[model];
  if (!p || !usage) return 0;
  const invoer = Number(usage.input_tokens) || 0;
  const uitvoer = Number(usage.output_tokens) || 0;
  const cacheSchrijf = Number(usage.cache_creation_input_tokens) || 0;
  const cacheLees = Number(usage.cache_read_input_tokens) || 0;
  const zoek = Number(usage.server_tool_use?.web_search_requests) || 0;
  return (invoer * p.invoer + uitvoer * p.uitvoer + cacheSchrijf * p.invoer * 1.25 + cacheLees * p.invoer * 0.1) / 1e6
    + zoek * PRIJS_PER_ZOEKOPDRACHT;
}

async function logVerbruik({ token, gebruiker, functie, model, usage }) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!usage || !token || !supabaseUrl || !supabaseAnonKey) return;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await supabase.from("ai_verbruik").insert({
      gebruiker_id: gebruiker.id,
      email: gebruiker.email || null,
      functie,
      model,
      invoer_tokens: Number(usage.input_tokens) || 0,
      uitvoer_tokens: Number(usage.output_tokens) || 0,
      cache_schrijf_tokens: Number(usage.cache_creation_input_tokens) || 0,
      cache_lees_tokens: Number(usage.cache_read_input_tokens) || 0,
      webzoekopdrachten: Number(usage.server_tool_use?.web_search_requests) || 0,
      kosten_usd: Number(berekenKosten(model, usage).toFixed(6)),
    });
    if (error) console.error("Kon AI-verbruik niet loggen:", error.message);
  } catch (err) {
    console.error("Kon AI-verbruik niet loggen:", err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Enkel POST toegelaten" } });
  }

  const gebruiker = await verifieerGebruiker(req);
  if (!gebruiker) {
    return res.status(401).json({ error: { message: "Niet aangemeld — log opnieuw in en probeer het nogmaals." } });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: "ANTHROPIC_API_KEY ontbreekt op de server" } });
  }

  const { model, max_tokens, tools, documentUrls, promptText, functie } = req.body || {};
  const veiligeFunctie = TOEGELATEN_FUNCTIES.includes(functie) ? functie : "onbekend";
  let { messages } = req.body || {};

  // Het model kwam voordien ongefilterd uit de browser en werd zo doorgestuurd: wie een geldige
  // sessie had, kon dus een veel duurder model kiezen dan wat de app zelf gebruikt. Idem voor
  // "tools" (web_search wordt apart aangerekend). Beide staan nu vast op de server.
  if (!TOEGELATEN_MODELLEN.includes(model)) {
    return res.status(400).json({ error: { message: "Onbekend of niet-toegelaten AI-model." } });
  }
  let veiligeTools;
  if (tools) {
    if (!Array.isArray(tools) || tools.some((t) => !TOEGELATEN_TOOLS.includes(t?.type))) {
      return res.status(400).json({ error: { message: "Niet-toegelaten AI-hulpmiddel gevraagd." } });
    }
    veiligeTools = tools.map((t) => (t.type === "web_search_20250305"
      ? { ...t, max_uses: Math.min(Number(t.max_uses) || MAX_WEBZOEKOPDRACHTEN, MAX_WEBZOEKOPDRACHTEN) }
      : t));
  }

  // Verbruiksgrens per gebruiker. Serverless functies delen geen geheugen, dus dit is bewust een
  // grove rem (per instantie) en geen exacte teller — bedoeld om te verhinderen dat één gelekte
  // sessie of één script in korte tijd een grote Anthropic-factuur veroorzaakt.
  const nu = Date.now();
  const bucket = _verbruik.get(gebruiker.id) || { tot: nu + UUR_MS, aantal: 0 };
  if (nu > bucket.tot) { bucket.tot = nu + UUR_MS; bucket.aantal = 0; }
  bucket.aantal += 1;
  _verbruik.set(gebruiker.id, bucket);
  if (bucket.aantal > MAX_AI_PER_UUR) {
    return res.status(429).json({ error: { message: `Te veel AI-aanvragen na elkaar (max. ${MAX_AI_PER_UUR} per uur). Probeer het later opnieuw.` } });
  }

  if (documentUrls && documentUrls.length) {
    if (documentUrls.length > MAX_DOCUMENTEN) {
      return res.status(400).json({ error: { message: `Te veel documenten in één aanvraag (max. ${MAX_DOCUMENTEN}).` } });
    }
    // SSRF-bescherming: enkel documenten ophalen die effectief op ONS EIGEN Supabase-project
    // staan (waar de frontend ze ook naartoe uploadt) — nooit een willekeurige, door de
    // aanvrager opgegeven URL, anders kan deze server misbruikt worden om interne/onbereikbare
    // adressen te bevragen namens de aanvaller.
    const toegelatenOrigin = (() => {
      try { return new URL(process.env.VITE_SUPABASE_URL).origin; } catch { return null; }
    })();
    const docBlocks = [];
    let totaalBytes = 0;
    for (const doc of documentUrls) {
      let docOrigin;
      try { docOrigin = new URL(doc.url).origin; } catch { docOrigin = null; }
      if (!toegelatenOrigin || docOrigin !== toegelatenOrigin) {
        return res.status(400).json({ error: { message: "Enkel documenten van het eigen Supabase-project zijn toegelaten." } });
      }
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
      // ook het totaal over alle documenten samen begrenzen — voordien werd enkel per document
      // gecontroleerd, waardoor een reeks documenten samen alsnog onbeperkt kon oplopen
      totaalBytes += buf.byteLength;
      if (totaalBytes > MAX_TOTAAL_BYTES) {
        return res.status(413).json({ error: { message: "De documenten samen zijn te groot voor één AI-analyse." } });
      }
      const mediaType = doc.mediaType || "application/pdf";
      docBlocks.push({
        type: mediaType.startsWith("image/") ? "image" : "document",
        source: { type: "base64", media_type: mediaType, data: Buffer.from(buf).toString("base64") },
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
        ...(veiligeTools ? { tools: veiligeTools } : {}),
      }),
    });

    const data = await response.json();
    // vóór het antwoord terugsturen (een serverless functie kan na de respons al stoppen), maar
    // logVerbruik gooit nooit een fout — zie hierboven
    if (response.ok) {
      await logVerbruik({ token: haalToken(req), gebruiker, functie: veiligeFunctie, model, usage: data?.usage });
    }
    return res.status(response.status).json(data);
  } catch (err) {
    // de volledige fout blijft in de Vercel-logs staan; naar de browser gaat enkel een neutrale
    // melding, zodat interne hostnamen en paden niet naar buiten lekken
    console.error("Anthropic onbereikbaar:", err);
    return res.status(502).json({ error: { message: "De AI-dienst is momenteel niet bereikbaar. Probeer het straks opnieuw." } });
  }
}

// LET OP: dit "config"-blok is een Next.js-conventie en heeft in een gewone Vercel-functie GEEN
// effect (zie de uitleg onderaan api/generate-pdf.js). De echte grens is Vercel's vaste 4,5MB per
// aanvraag; die is niet instelbaar. Behouden als documentatie van de bedoelde grootte-orde.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};
