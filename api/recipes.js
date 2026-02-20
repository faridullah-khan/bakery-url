const { readRaw, overwriteRows } = require("./_lib/sheets");
const setCors = require("./_lib/cors");
const { requireApiKey } = require("./_lib/auth");

const RANGE = "Recipes!A1:C"; // productId, ingredientId, quantity

const parseRows = (rows) => {
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((r) => headers.reduce((acc, h, i) => ({ ...acc, [h]: r[i] }), {}));
};

const handler = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!requireApiKey(req, res)) return;

  try {
    const rows = await readRaw(RANGE);
    const headers = rows[0] || ["productId", "ingredientId", "quantity"];
    const dataRows = rows.slice(1);

    if (req.method === "GET") {
      if (!req.query.productId) {
        return res.status(200).json(parseRows(rows));
      }
      const productId = req.query.productId;
      const filtered = dataRows
        .filter((r) => r[headers.indexOf("productId")] === productId)
        .map((r) => headers.reduce((acc, h, i) => ({ ...acc, [h]: r[i] }), {}));
      if (!filtered.length) return res.status(404).json({ error: "Not found" });
      return res.status(200).json(filtered);
    }

    if (req.method === "PUT") {
      const productId = req.query.productId || req.body?.productId;
      if (!productId) return res.status(400).json({ error: "productId is required" });
      const incoming = Array.isArray(req.body?.ingredients) ? req.body.ingredients : [];
      const filtered = dataRows.filter((r) => r[headers.indexOf("productId")] !== productId);
      const newRows = incoming.map((ing) => headers.map((h) => ing[h] ?? (h === "productId" ? productId : "")));
      const next = [...filtered, ...newRows];
      await overwriteRows(RANGE, [headers, ...next]);
      return res.status(200).json({ ok: true, productId });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("recipes error", err);
    return res.status(500).json({ error: "Internal error", details: err.message });
  }
};

module.exports = handler;

