import crypto from "crypto";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.join(__dirname, "data", "token.json");
const SCOPES = "read_products";
const nonces = new Set();

export function buildAuthUrl(shop, apiKey, redirectUri) {
  const nonce = crypto.randomBytes(16).toString("hex");
  nonces.add(nonce);
  const params = new URLSearchParams({
    client_id: apiKey,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state: nonce,
  });
  return `https://${shop}/admin/oauth/authorize?${params}`;
}

export function verifyHmac(query, apiSecret) {
  const { hmac, ...rest } = query;
  const message = Object.keys(rest).sort().map((k) => `${k}=${rest[k]}`).join("&");
  const digest = crypto.createHmac("sha256", apiSecret).update(message).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}

export async function exchangeToken(shop, code, apiKey, apiSecret) {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: apiKey, client_secret: apiSecret, code }),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  const { access_token } = await res.json();
  return access_token;
}

export function saveToken(shop, token) {
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({ shop, token }, null, 2));
  process.env.SHOPIFY_ACCESS_TOKEN = token;
  process.env.SHOPIFY_SHOP = shop;
}

export function loadToken() {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")); }
  catch { return null; }
}

export function consumeNonce(nonce) {
  if (!nonces.has(nonce)) return false;
  nonces.delete(nonce);
  return true;
}
