const { v4: uuidv4 } = require("uuid");
const { readRaw, overwriteRows } = require("./_lib/sheets");
const setCors = require("./_lib/cors");
const { requireApiKey } = require("./_lib/auth");

const RANGE = "Inventory!A1:F"; // headers: id, name, sellBy, unitPrice, costPerUnit, stock

const parseRows = (rows) => {
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((r) =>
    headers.reduce((acc, h, i) => {
      acc[h] = r[i];
      return acc;
    }, {})
  );
};

const handler = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!requireApiKey(req, res)) return;

  try {
    const rows = await readRaw(RANGE);
    if (req.method === "GET") {
      return res.status(200).json(parseRows(rows));
    }

    if (req.method === "POST") {
      const headers = rows[0] || ["id", "name", "sellBy", "unitPrice", "costPerUnit", "stock"];
      const dataRows = rows.slice(1);
      const payload = req.body || {};
      const id = payload.id || uuidv4();
      const row = headers.map((h) => payload[h] ?? "");
      if (!payload.name) return res.status(400).json({ error: "name is required" });
      dataRows.push(row);
      await overwriteRows(RANGE, [headers, ...dataRows]);
      return res.status(201).json({ id, ...payload });
    }

    if (req.method === "PUT") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "id is required" });
      const headers = rows[0] || [];
      const dataRows = rows.slice(1);
      const idx = dataRows.findIndex((r) => r[headers.indexOf("id")] === id);
      if (idx === -1) return res.status(404).json({ error: "Not found" });
      const current = dataRows[idx];
      const merged = headers.map((h, i) => req.body?.[h] ?? current[i] ?? "");
      dataRows[idx] = merged;
      await overwriteRows(RANGE, [headers, ...dataRows]);
      return res.status(200).json(headers.reduce((acc, h, i) => ({ ...acc, [h]: merged[i] }), {}));
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "id is required" });
      const headers = rows[0] || [];
      const dataRows = rows.slice(1);
      const filtered = dataRows.filter((r) => r[headers.indexOf("id")] !== id);
      if (filtered.length === dataRows.length) return res.status(404).json({ error: "Not found" });
      await overwriteRows(RANGE, [headers, ...filtered]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("inventory error", err);
    return res.status(500).json({ error: "Internal error", details: err.message });
  }
};

module.exports = handler;

