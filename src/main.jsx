import React from "react";
import ReactDOM from "react-dom/client";
import AppRoot, { FoutGrens } from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <FoutGrens>
      <AppRoot />
    </FoutGrens>
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
