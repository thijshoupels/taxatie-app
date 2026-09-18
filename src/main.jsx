import React from "react";
import ReactDOM from "react-dom/client";
// Vercel Analytics (bezoekcijfers) en Speed Insights (laadtijden zoals echte bezoekers ze ervaren).
// Beide zijn losse pakketten die enkel iets doen op een Vercel-deployment: lokaal (npm run dev) en
// in de tests zijn het lege componenten die niets versturen. Ze werken zonder cookies en meten
// paginapaden, niet de inhoud van formulieren — en omdat de wizard via interne state navigeert en
// niet via de URL, komt er geen enkel dossiergegeven in die paden terecht.
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import AppRoot, { FoutGrens } from "./App.jsx";
import { pasOpgeslagenThemaToe } from "./ui/ThemeToggle.jsx";
import "./index.css";

// Zet een eerder gekozen donkere/lichte modus (via de knop in het dashboard) meteen op <html>,
// vóór de eerste render — zo flitst het scherm bij het opstarten niet kort in de
// systeeminstelling om daarna pas naar de eigen keuze om te schakelen.
pasOpgeslagenThemaToe();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <FoutGrens>
      <AppRoot />
    </FoutGrens>
    {/* bewust NAAST de foutgrens en niet erbinnen: zo kan een probleem in de meetcomponenten de
        app zelf niet in het foutscherm duwen, en omgekeerd houdt een foutscherm in de app deze
        twee niet tegen */}
    <Analytics />
    <SpeedInsights />
  </React.StrictMode>
);

// registreert de serviceworker (public/sw.js) zodat de browser deze webapp als installeerbare
// PWA herkent — geeft een eigen icoon + eigen venster op Windows/Mac (en Android), zonder dat er
// verder iets aan de app verandert. Faalt dit (bv. een oudere browser), dan werkt de webapp
// gewoon zoals voorheen, enkel zonder installatiemogelijkheid.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
