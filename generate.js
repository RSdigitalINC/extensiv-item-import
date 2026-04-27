import ExcelJS from "exceljs";
import fetch from "node-fetch";

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

const COLUMNS = [
  { header: "SKU", key: "sku", width: 20, required: true },
  { header: "Description", key: "description", width: 52, required: true },
  { header: "Description2", key: "description2", width: 20 },
  { header: "Min", key: "min", width: 8 },
  { header: "Max", key: "max", width: 8 },
  { header: "Cycle Count", key: "cycleCount", width: 12 },
  { header: "ReorderQty", key: "reorderQty", width: 12 },
  { header: "Inventory Method", key: "invMethod", width: 18 },
  { header: "Temperature", key: "temperature", width: 14 },
  { header: "Cost", key: "cost", width: 10 },
  { header: "UPC", key: "upc", width: 20, required: true },
  { header: "Track Lot", key: "trackLot", width: 12 },
  { header: "Track Serial", key: "trackSerial", width: 14 },
  { header: "Track ExpDate", key: "trackExpDate", width: 16 },
  { header: "Primary Unit of Measure", key: "primaryUOM", width: 22, required: true },
  { header: "Packaging Unit", key: "packagingUnit", width: 16 },
  { header: "Packing UOM Qty", key: "packingUOMQty", width: 16 },
  { header: "Length", key: "length", width: 10 },
  { header: "Width", key: "width", width: 10 },
  { header: "Height", key: "height", width: 10 },
  { header: "Weight", key: "weight", width: 10 },
  { header: "Qualifiers", key: "qualifiers", width: 14 },
  { header: "Storage Setup", key: "storageSetup", width: 16 },
  { header: "Variable Setup", key: "variableSetup", width: 16 },
  { header: "NMFC#", key: "nmfc", width: 10 },
  { header: "Lot Number Required", key: "lotNumReq", width: 20 },
  { header: "Serial Number Required", key: "serialNumReq", width: 22 },
  { header: "Serial Number (must be unique)", key: "serialNum", width: 28 },
  { header: "Exp Date Req", key: "expDateReq", width: 14 },
  { header: "Enable Cost", key: "enableCost", width: 14 },
  { header: "Cost Required", key: "costRequired", width: 14 },
  { header: "IsHazMat", key: "isHazMat", width: 12 },
  { header: "HazMatID", key: "hazMatID", width: 12 },
  { header: "HazMatShippingName", key: "hazMatShip", width: 22 },
  { header: "HazMatHazardClass", key: "hazMatClass", width: 20 },
  { header: "HazMatPackingGroup", key: "hazMatPack", width: 20 },
  { header: "HazMatFlashPoint", key: "hazMatFlash", width: 18 },
  { header: "HazMatLabelCode", key: "hazMatLabel", width: 18 },
  { header: "HazMatFlag", key: "hazMatFlag", width: 14 },
  { header: "Image URL", key: "imageURL", width: 30 },
  { header: "StorageCountScriptTemplateID", key: "storageScript", width: 30 },
  { header: "StorageRates", key: "storageRates", width: 16 },
  { header: "OutboundMobileSerializationBehavior", key: "outboundSer", width: 36 },
  { header: "Price", key: "price", width: 10 },
  { header: "TotalQty", key: "totalQty", width: 12 },
  { header: "UnitType", key: "unitType", width: 12 },
];

async function buildXlsx(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Item Import Template");
  ws.addRow([]);
  ws.getRow(1).getCell(6).value = "Item Import Template";
  ws.getRow(1).getCell(12).value = " *Berry headers are required fields";
  ws.addRow(COLUMNS.map((c) => c.header));
  const headerRow = ws.getRow(2);
  headerRow.height = 28;
  COLUMNS.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width;
    const cell = headerRow.getCell(i + 1);
    cell.font = { bold: true, size: 10, color: { argb: col.required ? "FF8B0000" : "FF333333" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: "FF999999" } } };
  });
  for (const row of rows) ws.addRow(COLUMNS.map((c) => row[c.key] ?? ""));
  ws.views = [{ state: "frozen", ySplit: 2 }];
  const wsI = wb.addWorksheet("Instructions");
  [
    ["1. Delete rows 1 and 2 before importing."],
    ["2. Save as Tab-Delimited Text (.txt)."],
    ["3. Upload via the Extensiv Item Import screen."],
  ].forEach((r) => wsI.addRow(r));
  return wb.xlsx.writeBuffer();
}

export async function generateTemplate({ shop, accessToken, customerCode, tag }) {
  const products = await fetchAllProducts(shop, accessToken, tag);
  const { rows, skipped } = buildRows(products);
  console.log(`[generate] ${rows.length} rows | ${skipped.length} skipped (no barcode)`);
  return buildXlsx(rows);
}
