import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import { buildAuthUrl, verifyHmac, exchangeToken, saveToken, loadToken, consumeNonce } from "./oauth.js";
import { generateTemplate } from "./generate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  PORT = 3000,
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  SHOPIFY_SHOP,
  APP_URL,
} = process.env;

if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET || !SHOPIFY_SHOP || !APP_URL) {
  console.error("Missing required env vars: SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_SHOP, APP_URL");
  process.exit(1);
}

const saved = loadToken();
if (saved) {
  process.env.SHOPIFY_ACCESS_TOKEN = saved.token;
  console.log(`[startup] Loaded saved token for ${saved.shop}`);
} else {
  console.log("[startup] No saved token — visit /auth to install the app");
}

const REDIRECT_URI = `${APP_URL}/auth/callback`;
const app = express();
app.use(cors());
app.use(express.json());

// Required for Shopify embedded apps — allows the admin iframe to load the app
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    `frame-ancestors https://${SHOPIFY_SHOP} https://admin.shopify.com`
  );
  next();
});

app.use(express.static(path.join(__dirname, "dist")));

app.get("/auth", (req, res) => {
  const shop = (req.query.shop ?? SHOPIFY_SHOP).toLowerCase().trim();
  if (!shop.endsWith(".myshopify.com")) return res.status(400).send("Invalid shop domain.");
  res.redirect(buildAuthUrl(shop, SHOPIFY_API_KEY, REDIRECT_URI));
});

app.get("/auth/callback", async (req, res) => {
  const { shop, code, state, hmac } = req.query;
  if (!consumeNonce(state)) return res.status(403).send("Invalid state.");
  if (!verifyHmac(req.query, SHOPIFY_API_SECRET)) return res.status(403).send("HMAC validation failed.");
  if (shop.toLowerCase() !== SHOPIFY_SHOP.toLowerCase()) return res.status(403).send(`Shop mismatch.`);
  try {
    const token = await exchangeToken(shop, code, SHOPIFY_API_KEY, SHOPIFY_API_SECRET);
    saveToken(shop, token);
    console.log(`[oauth] Token saved for ${shop}`);
    console.log(`[oauth] Access token: ${token}`);
    console.log(`[oauth] → Copy this into Railway as SHOPIFY_ACCESS_TOKEN`);
    res.redirect(`https://${shop}/admin/apps/${SHOPIFY_API_KEY}`);
  } catch (err) {
    console.error("[oauth]", err.message);
    res.status(500).send(`OAuth error: ${err.message}`);
  }
});

function verifySessionToken(req, res, next) {
  const token = (req.headers.authorization ?? "").replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "Missing session token" });
  try {
    const decoded = jwt.verify(token, SHOPIFY_API_SECRET, { algorithms: ["HS256"] });
    const dest = decoded.dest?.replace("https://", "");
    if (dest !== SHOPIFY_SHOP) return res.status(403).json({ error: "Token shop mismatch" });
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid session token", detail: err.message });
  }
}

app.post("/api/generate", verifySessionToken, async (req, res) => {
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!accessToken) return res.status(503).json({ error: "App not installed. Visit /auth first." });
  const customerCode = (req.body.customerCode ?? "").trim().toUpperCase();
  const tag = (req.body.tag ?? "").trim() || null;
  try {
    const buffer = await generateTemplate({ shop: SHOPIFY_SHOP, accessToken, customerCode, tag });
    const date = new Date().toISOString().slice(0, 10);
    const codePart = customerCode ? `_${customerCode}` : "";
    const tagSuffix = tag ? `_${tag.replace(/\s+/g, "-")}` : "";
    const filename = `Item_Import_Template${codePart}${tagSuffix}_${date}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err) {
    console.error("[generate]", err);
    res.status(500).json({ error: "Generation failed", detail: err.message });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
