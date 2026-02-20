const API_SECRET = process.env.API_SHARED_SECRET;

const requireApiKey = (req, res) => {
  if (!API_SECRET) return true; // no secret set; allow
  const header = req.headers["x-api-key"] || req.headers["authorization"];
  if (header === API_SECRET || header === `Bearer ${API_SECRET}`) return true;
  res.status(401).json({ error: "Unauthorized" });
  return false;
};

module.exports = { requireApiKey };

