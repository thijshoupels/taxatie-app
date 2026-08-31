// Minimale serviceworker — enkel nodig zodat browsers de app als een installeerbare PWA
// herkennen (zie public/manifest.json). Cachet bewust NIETS van /api/* of van een andere
// oorsprong (Supabase/Anthropic lopen los, ongemoeid) — dit is een dossier-/financiële app,
// een verouderd gecached antwoord zou daar meer kwaad dan goed doen.
const CACHE_NAAM = "taxatie-app-shell-v1";
const SHELL_BESTANDEN = ["/", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAAM).then((cache) => cache.addAll(SHELL_BESTANDEN)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((namen) =>
      Promise.all(namen.filter((n) => n !== CACHE_NAAM).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // netwerk-eerst: toont altijd de meest actuele versie zolang er verbinding is — enkel bij een
  // écht offline moment (bv. tijdelijk wifi-verlies) valt dit terug op de laatst gekende versie,
  // zodat de gebruiker een herkenbaar scherm ziet in plaats van een kale browserfoutpagina.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const kopie = response.clone();
        caches.open(CACHE_NAAM).then((cache) => cache.put(request, kopie)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
  );
});
