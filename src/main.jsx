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
