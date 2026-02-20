const { readRaw, overwriteRows, appendRows } = require("./_lib/sheets");
const setCors = require("./_lib/cors");
const { requireApiKey } = require("./_lib/auth");

const INVENTORY_RANGE = "Inventory!A1:F";
const RECIPES_RANGE = "Recipes!A1:C";
const SALES_RANGE = "Sales!A1:E"; // id, timestamp, totalPKR, costPKR, payload(json)

const toNumber = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const parseRows = (rows) => {
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((r) => headers.reduce((acc, h, i) => ({ ...acc, [h]: r[i] }), {}));
};

const handler = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!requireApiKey(req, res)) return;

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: "Items array is required" });

  try {
    const invRows = await readRaw(INVENTORY_RANGE);
    const invHeaders = invRows[0] || ["id", "name", "sellBy", "unitPrice", "costPerUnit", "stock"];
    const invData = parseRows(invRows);
    const recRows = await readRaw(RECIPES_RANGE);
    const recHeaders = recRows[0] || ["productId", "ingredientId", "quantity"];
    const recData = parseRows(recRows);

    let totalPKR = 0;
    let totalCost = 0;
    const invMap = Object.fromEntries(invData.map((r) => [r.id, r]));

    for (const item of items) {
      const prod = invMap[item.productId];
      if (!prod) return res.status(404).json({ error: `Product ${item.productId} not found` });
      const qty = toNumber(item.quantity);
      const price = toNumber(item.price);
      const lineTotal = qty * price;
      totalPKR += lineTotal;

      const recipeLines = recData.filter((r) => r.productId === item.productId);
      let costPerUnit = 0;
      for (const r of recipeLines) {
        const ing = invMap[r.ingredientId];
        if (!ing) return res.status(404).json({ error: `Ingredient ${r.ingredientId} not found` });
        const required = toNumber(r.quantity) * qty;
        const currentStock = toNumber(ing.stock);
        if (currentStock - required < 0) return res.status(400).json({ error: `Insufficient stock for ${ing.name}` });
        costPerUnit += toNumber(ing.costPerUnit) * toNumber(r.quantity);
        ing.stock = (currentStock - required).toString();
      }
      const costLine = costPerUnit * qty;
      totalCost += costLine;
    }

    // Persist inventory updates
    const updatedInvRows = [invHeaders, ...Object.values(invMap).map((r) => invHeaders.map((h) => r[h] ?? ""))];
    await overwriteRows(INVENTORY_RANGE, updatedInvRows);

    // Append sale
    const saleId = Date.now().toString();
    const payload = JSON.stringify(items);
    await appendRows(SALES_RANGE, [[saleId, new Date().toISOString(), totalPKR, totalCost, payload]]);

    return res.status(201).json({ id: saleId, totalPKR, totalCost });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("sale error", err);
    return res.status(500).json({ error: "Internal error", details: err.message });
  }
};

module.exports = handler;

