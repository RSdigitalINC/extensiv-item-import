import ExcelJS from "exceljs";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_VERSION = "2024-04";

const DEFAULTS = {
  trackLot: "FALSE", trackSerial: "FALSE", trackExpDate: "FALSE",
  primaryUOM: "Each", packagingUnit: "Carton", packingUOMQty: 12,
  length: 1, width: 1, height: 1, weight: 1,
  lotNumReq: "FALSE", serialNumReq: "FALSE", serialNum: "FALSE",
  expDateReq: "FALSE", enableCost: "FALSE", costRequired: "FALSE",
};

async function fetchAllProducts(shop, accessToken, tag) {
  const products = [];
  let url = `https://${shop}/admin/api/${API_VERSION}/products.json?limit=250&fields=vendor,title,variants,tags`;
  while (url) {
    const res = await fetch(url, { headers: { "X-Shopify-Access-Token": accessToken } });
    if (!res.ok) throw new Error(`Shopify ${res.status}: ${await res.text()}`);
    const data = await res.json();
    products.push(...data.products);
    const link = res.headers.get("link") ?? "";
    const match = link.match(/<([^>]+)>;\s*rel="next"/);
    url = match ? match[1] : null;
  }
  if (tag) {
    const normalised = tag.trim().toLowerCase();
    return products.filter(p =>
      (p.tags ?? "").split(",").map(t => t.trim().toLowerCase()).includes(normalised)
    );
  }
  return products;
}

function buildRows(products) {
  const rows = [], skipped = [];
  for (const product of products) {
    for (const variant of product.variants) {
      const barcode = variant.barcode?.trim();
      if (!barcode) { skipped.push(`${product.vendor} - ${product.title} - ${variant.title}`); continue; }
      const variantLabel = variant.title === "Default Title" ? "Default Title" : variant.title;
      rows.push({
        sku: barcode,
        description: `${product.vendor} - ${product.title} - ${variantLabel}`,
        description2: "", min: "", max: "", cycleCount: "", reorderQty: "",
        invMethod: "", temperature: "", cost: "", upc: barcode, ...DEFAULTS,
        qualifiers: "", storageSetup: "", variableSetup: "", nmfc: "",
        isHazMat: "", hazMatID: "", hazMatShip: "", hazMatClass: "",
        hazMatPack: "", hazMatFlash: "", hazMatLabel: "", hazMatFlag: "",
        imageURL: "", storageScript: "", storageRates: "", outboundSer: "",
        price: "", totalQty: "", unitType: "",
      });
    }
  }
  return { rows, skipped };
}

// required: true → dark teal bg (415364) matching actual Extensiv template
const COLUMNS = [
  { header: "SKU", key: "sku", width: 52, required: true },
  { header: "Description", key: "description", width: 19, required: true },
  { header: "Description2", key: "description2", width: 19 },
  { header: "Min", key: "min", width: 13 },
  { header: "Max", key: "max", width: 13 },
  { header: "Cycle Count", key: "cycleCount", width: 13 },
  { header: "ReorderQty", key: "reorderQty", width: 13 },
  { header: "Inventory Method", key: "invMethod", width: 13 },
  { header: "Temperature", key: "temperature", width: 13 },
  { header: "Cost", key: "cost", width: 13 },
  { header: "UPC", key: "upc", width: 13 },
  { header: "Track Lot", key: "trackLot", width: 13, required: true },
  { header: "Track Serial", key: "trackSerial", width: 13, required: true },
  { header: "Track ExpDate", key: "trackExpDate", width: 13, required: true },
  { header: "Primary Unit of Measure", key: "primaryUOM", width: 13, required: true },
  { header: "Packaging Unit", key: "packagingUnit", width: 13, required: true },
  { header: "Packing UOM Qty", key: "packingUOMQty", width: 13, required: true },
  { header: "Length", key: "length", width: 13, required: true },
  { header: "Width", key: "width", width: 13, required: true },
  { header: "Height", key: "height", width: 13, required: true },
  { header: "Weight", key: "weight", width: 13, required: true },
  { header: "Qualifiers", key: "qualifiers", width: 13 },
  { header: "Storage Setup", key: "storageSetup", width: 13 },
  { header: "Variable Setup", key: "variableSetup", width: 13 },
  { header: "NMFC#", key: "nmfc", width: 13 },
  { header: "Lot Number Required", key: "lotNumReq", width: 13, required: true },
  { header: "Serial Number Required", key: "serialNumReq", width: 13, required: true },
  { header: "Serial Number (must be unique)", key: "serialNum", width: 13, required: true },
  { header: "Exp Date Req", key: "expDateReq", width: 13, required: true },
  { header: "Enable Cost", key: "enableCost", width: 13, required: true },
  { header: "Cost Required", key: "costRequired", width: 13, required: true },
  { header: "IsHazMat", key: "isHazMat", width: 13 },
  { header: "HazMatID", key: "hazMatID", width: 13 },
  { header: "HazMatShippingName", key: "hazMatShip", width: 13 },
  { header: "HazMatHazardClass", key: "hazMatClass", width: 13 },
  { header: "HazMatPackingGroup", key: "hazMatPack", width: 13 },
  { header: "HazMatFlashPoint", key: "hazMatFlash", width: 13 },
  { header: "HazMatLabelCode", key: "hazMatLabel", width: 13 },
  { header: "HazMatFlag", key: "hazMatFlag", width: 13 },
  { header: "Image URL", key: "imageURL", width: 13 },
  { header: "StorageCountScriptTemplateID", key: "storageScript", width: 13 },
  { header: "StorageRates", key: "storageRates", width: 13 },
  { header: "OutboundMobileSerializationBehavior", key: "outboundSer", width: 13 },
  { header: "Price", key: "price", width: 13 },
  { header: "TotalQty", key: "totalQty", width: 13 },
  { header: "UnitType", key: "unitType", width: 13 },
];

// Extensiv brand colors extracted from original template
const COLOR_BERRY   = "FFD6006D"; // required header background (berry pink)
const COLOR_TEAL    = "FF415364"; // row 1 background (dark navy/teal)
const COLOR_WHITE   = "FFFFFFFF";
const COLOR_DARK    = "FF000000";
const COLOR_LIGHT   = "FFBFBFBF"; // non-required header font

async function buildXlsx(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Item Import Template");

  // ── Embed logo ──────────────────────────────────────────────────────────
  const logoPath = path.join(__dirname, "extensiv-logo.png");
  let logoImageId = null;
  if (fs.existsSync(logoPath)) {
    logoImageId = wb.addImage({ buffer: fs.readFileSync(logoPath), extension: "png" });
    ws.addImage(logoImageId, {
      tl: { col: 0, row: 0 },
      br: { col: 1.8, row: 0.6 },
      editAs: "oneCell",
    });
  }

  // ── Row 1: title bar ─────────────────────────────────────────────────────
  ws.getRow(1).height = 54;
  const titleFill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TEAL } };

  // Berry background across all columns
  for (let c = 1; c <= COLUMNS.length; c++) {
    ws.getCell(1, c).fill = titleFill;
  }

  // Merge A1:C1 for logo area (keep blank value, image sits on top)
  ws.mergeCells("A1:C1");

  // "Item Import Template" in F1:I1
  ws.mergeCells("F1:I1");
  const titleCell = ws.getCell("F1");
  titleCell.value = "Item Import Template";
  titleCell.fill = titleFill;
  titleCell.font = { bold: true, size: 14, color: { argb: COLOR_WHITE }, name: "Calibri" };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };

  // "*Berry headers are required fields" in J1:M1
  ws.mergeCells("J1:M1");
  const noteCell = ws.getCell("J1");
  noteCell.value = " *Berry headers are required fields";
  noteCell.fill = titleFill;
  noteCell.font = { italic: true, size: 10, color: { argb: COLOR_WHITE }, name: "Calibri" };
  noteCell.alignment = { vertical: "middle", horizontal: "left" };

  // Fill remaining merged groups with berry bg (matching template structure)
  const extraMerges = ["N1:Q1","R1:U1","V1:Y1","Z1:AC1","AD1:AG1","AH1:AK1","AL1:AO1","AP1:AS1"];
  extraMerges.forEach(range => {
    ws.mergeCells(range);
    ws.getCell(range.split(":")[0]).fill = titleFill;
  });

  // ── Row 2: column headers ─────────────────────────────────────────────────
  ws.getRow(2).height = 23.45;
  COLUMNS.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width;
    const cell = ws.getCell(2, i + 1);
    cell.value = col.header;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    if (col.required) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_BERRY } };
      cell.font = { bold: true, size: 12, color: { argb: COLOR_WHITE }, name: "Calibri" };
    } else {
      cell.font = { bold: false, size: 12, color: { argb: COLOR_DARK }, name: "Calibri" };
    }
    cell.border = {
      left: { style: "thin" }, right: { style: "thin" },
      top: { style: "medium" }, bottom: { style: "medium" },
    };
  });

  // ── Data rows ─────────────────────────────────────────────────────────────
  for (const row of rows) {
    ws.addRow(COLUMNS.map(c => row[c.key] ?? ""));
  }

  ws.views = [{ state: "frozen", ySplit: 2 }];

  // ── Instructions sheet ───────────────────────────────────────────────────
  const wsI = wb.addWorksheet("Instructions");
  [
    ["1. Delete rows 1 and 2 before importing."],
    ["2. Save as Tab-Delimited Text (.txt)."],
    ["3. Upload via the Extensiv Item Import screen."],
  ].forEach(r => wsI.addRow(r));

  return wb.xlsx.writeBuffer();
}

export async function generateTemplate({ shop, accessToken, customerCode, tag }) {
  const products = await fetchAllProducts(shop, accessToken, tag);
  const { rows, skipped } = buildRows(products);
  console.log(`[generate] ${rows.length} rows | ${skipped.length} skipped (no barcode)${tag ? ` | tag: ${tag}` : ""}`);
  return buildXlsx(rows);
}
