const { google } = require("googleapis");

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

if (!SHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
  // eslint-disable-next-line no-console
  console.warn("Google Sheets env vars missing: GOOGLE_SHEETS_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY");
}

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]; // read/write

const getAuth = () =>
  new google.auth.JWT({
    email: CLIENT_EMAIL,
    key: PRIVATE_KEY,
    scopes: SCOPES,
  });

const sheetsApi = () => google.sheets({ version: "v4", auth: getAuth() });

const readRows = async (range) => {
  const res = await sheetsApi().spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });
  const rows = res.data.values || [];
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx];
    });
    return obj;
  });
};

const appendRows = async (range, values) => {
  await sheetsApi().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
};

const overwriteRows = async (range, values) => {
  await sheetsApi().spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
};

const upsertById = async (range, idField, idValue, headers, rowData) => {
  const rows = await readRaw(range);
  const headerRow = rows[0] || headers;
  const dataRows = rows.slice(1);
  const idx = dataRows.findIndex((r) => r[headerRow.indexOf(idField)] === idValue);
  const rowArray = headerRow.map((h) => rowData[h] ?? "");
  if (idx === -1) {
    dataRows.push(rowArray);
  } else {
    dataRows[idx] = rowArray;
  }
  await overwriteRows(range, [headerRow, ...dataRows]);
};

const readRaw = async (range) => {
  const res = await sheetsApi().spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });
  return res.data.values || [];
};

module.exports = {
  readRows,
  appendRows,
  overwriteRows,
  readRaw,
  upsertById,
};

