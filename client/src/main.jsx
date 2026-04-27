import React from "react";
import ReactDOM from "react-dom/client";
import { Provider as AppBridgeProvider } from "@shopify/app-bridge-react";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import App from "./App";

const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY ?? "";
const host = new URLSearchParams(window.location.search).get("host") ?? "";

if (!host) {
  document.getElementById("root").innerHTML = `
    <div style="font-family:sans-serif;padding:48px;max-width:480px;margin:auto">
      <h2>Extensiv Item Import</h2>
      <p>This app must be opened from the Shopify Admin.</p>
      <a href="/auth" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#008060;color:#fff;border-radius:6px;text-decoration:none">Install App</a>
    </div>`;
} else {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <AppBridgeProvider config={{ apiKey, host, forceRedirect: false }}>
        <AppProvider i18n={enTranslations}>
          <App />
        </AppProvider>
      </AppBridgeProvider>
    </React.StrictMode>
  );
}
