import React from "react";
import ReactDOM from "react-dom/client";

const params = new URLSearchParams(window.location.search);
const host = params.get("host") ?? "(none)";
const shop = params.get("shop") ?? "(none)";

ReactDOM.createRoot(document.getElementById("root")).render(
  <div style={{ padding: 32, fontFamily: "sans-serif" }}>
    <h2>✅ React is working</h2>
    <p><strong>host:</strong> {host}</p>
    <p><strong>shop:</strong> {shop}</p>
    <p><strong>full URL:</strong> {window.location.href}</p>
  </div>
);
