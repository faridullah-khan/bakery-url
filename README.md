# Bakery POS on Vercel + Google Sheets

React frontend (Vite) + Vercel serverless API using Google Sheets as storage. POS supports unit/weight sales, PKR currency, inventory/recipes management, and checkout.

## Project structure
- `frontend/` – React app (builds to `dist`)
- `api/` – Vercel serverless routes (`/api/inventory`, `/api/recipes`, `/api/sale`)
- `api/_lib/` – Google Sheets helpers, CORS, auth
- `vercel.json` – Vercel build/routes config
- `.env.example` – env vars template

## Environment variables
Copy `.env.example` to `.env.local` (or set in Vercel dashboard).
```
NEXT_PUBLIC_API_BASE_URL=https://<your-vercel-app>.vercel.app/api
NEXT_PUBLIC_API_KEY=optional-shared-secret
GOOGLE_SHEETS_ID=<sheet-id>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<svc-email>
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
API_SHARED_SECRET=optional-shared-secret
```

## Google Sheets layout
- Sheet `Inventory`: `id, name, sellBy, unitPrice, costPerUnit, stock`
- Sheet `Recipes`: `productId, ingredientId, quantity`
- Sheet `Sales`: `id, timestamp, totalPKR, costPKR, payload(json)`

## Local dev (Vercel)
```bash
npm install
npm install --prefix frontend
npm run build --prefix frontend
vercel dev
```
Frontend uses `http://localhost:3000/api` during `vercel dev`.

## Deploy to Vercel
```bash
vercel link              # one-time
vercel env pull .env.local
vercel --prod            # deploy backend+frontend
```
Ensure env vars are set in Vercel (same as `.env.example`).

## API behavior
- Auth: optional shared secret via `API_SHARED_SECRET` checked against `x-api-key` or `Authorization` header.
- `/api/inventory` GET/POST/PUT/DELETE
- `/api/recipes` GET (all or ?productId) / PUT (replace product recipe)
- `/api/sale` POST (validates stock, updates inventory, records sale)
- Errors: 401 (unauthorized), 404 (not found), 400/500 with JSON bodies.

## ESLint note
`process` is accessed via `globalThis.process` to avoid `no-undef` in Vite.
