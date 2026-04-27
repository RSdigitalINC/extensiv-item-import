import React from "react";
import ReactDOM from "react-dom/client";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import App from "./App";

const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppProvider i18n={enTranslations} apiKey={apiKey}>
      <App />
    </AppProvider>
  </React.StrictMode>
);
