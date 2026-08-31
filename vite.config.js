import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vitest leest dit bestand mee ("npm test") — de rekenmodule (berekenWaardering, zie
  // src/App.jsx) wordt getest in een gewone Node-omgeving, zonder browser/DOM nodig, want ze
  // rekent enkel met getallen en heeft geen React-rendering nodig (zie audit, punt M4).
  test: {
    environment: "node",
  },
});
