# SmartCart Backend

Backend API për SmartCart AI me module MVP + foundations për features e PRD-së:

- Households & members
- Shopping list + categorization + activity log
- Real-time stream (SSE) për activity events
- Pricing estimate + flyers hints
- Pricing staging -> promotion workflow me validim bazik
- Canonical product matching + confidence scores (pricing pipeline)
- Pricing estimate cache me TTL 6 orë
- Receipts ingestion (manual payload) + budget updates
- Presigned upload URL (simuluar) + OCR jobs workflow
- Pantry tracking
- Recipe suggestions (AI-like stub) + rate limiting (3/ditë për user)
- Request-id dhe structured logs bazike
- Optimistic concurrency bazike në list items (`version`)

## E rëndësishme: GitHub import status
U provua importimi i kodit nga `https://github.com/burakorkmez/grocify-expo`, por qasja e rrjetit dështoi me `CONNECT tunnel failed, response 403` në këtë mjedis ekzekutimi.
Prandaj backend-i është ndërtuar këtu sipas PRD-së dhe arkitekturës së dakorduar.

## Run

```bash
cd backend
npm start
```

Serveri nis në `http://localhost:4000`.

## Test

```bash
cd backend
npm test
```

## Auth / Tenant scope
Aktualisht mbështetet:
- `x-user-id: <id>`
- `Authorization: Bearer dev-user:<id>` (dev mode)

Në fazën tjetër ky zëvendësohet me Clerk JWT + RLS enforcement në Postgres.

## API Endpoints

### System
- `GET /health`

### Households
- `POST /households`
- `GET /households`
- `POST /households/:householdId/members`

### Shopping lists
- `GET /households/:householdId/items`
- `POST /households/:householdId/items`
- `PATCH /households/:householdId/items/:itemId` (opsionale: `expectedVersion` në body)
- `GET /households/:householdId/activity`
- `GET /households/:householdId/stream` (SSE real-time events)

### Budget & Receipts
- `GET /households/:householdId/budget`
- `PUT /households/:householdId/budget`
- `POST /households/:householdId/receipts`
- `GET /households/:householdId/receipts`
- `POST /households/:householdId/receipts/upload-url`
- `POST /households/:householdId/receipts/ocr-jobs`
- `GET /households/:householdId/receipts/ocr-jobs`
- `POST /households/:householdId/receipts/ocr-jobs/:jobId/apply`

### Pricing & Flyers
- `GET /households/:householdId/pricing/estimate`
- `GET /households/:householdId/flyers`
- `GET /pricing/pipeline`
- `GET /pricing/cache`
- `POST /pricing/staging`
- `POST /pricing/promote`

### Pantry & Recipes
- `GET /households/:householdId/pantry`
- `POST /households/:householdId/pantry`
- `POST /households/:householdId/recipes/suggest`

## Persistence
Implementimi aktual përdor in-memory store për zhvillim të shpejtë.
Skema SQL në `db/schema.sql` është baza për migrim në Postgres + Drizzle + RLS.
