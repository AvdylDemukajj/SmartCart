# Frontend → Backend Endpoint Mapping (SmartCart)

Ky dokument mapon flow-et kryesore të aplikacionit me endpoint-et aktuale të backend-it.

## Auth + Session
- Session check / bootstrap: `GET /health`
- User context: `x-user-id` ose `Authorization: Bearer ...`

## Household setup
- Krijo household: `POST /households`
- Listo households e user-it: `GET /households`
- Fto/shto anëtar: `POST /households/:householdId/members`

## Shopping list
- Merr item-at: `GET /households/:householdId/items`
- Shto item: `POST /households/:householdId/items`
- Toggle purchased/version update: `PATCH /households/:householdId/items/:itemId`
- Activity feed: `GET /households/:householdId/activity`
- Realtime stream: `GET /households/:householdId/stream`

## Pricing & flyers
- Estimate çmimesh: `GET /households/:householdId/pricing/estimate`
- Flyers hints: `GET /households/:householdId/flyers`

## Budget & receipts
- Merr budget: `GET /households/:householdId/budget`
- Update budget limit: `PUT /households/:householdId/budget`
- Shto receipt manual: `POST /households/:householdId/receipts`
- List receipts: `GET /households/:householdId/receipts`
- Upload URL (simulated): `POST /households/:householdId/receipts/upload-url`
- OCR enqueue/list/retry/correct/apply:
  - `POST /households/:householdId/receipts/ocr-jobs`
  - `GET /households/:householdId/receipts/ocr-jobs`
  - `POST /households/:householdId/receipts/ocr-jobs/:jobId/retry`
  - `PATCH /households/:householdId/receipts/ocr-jobs/:jobId/correct`
  - `POST /households/:householdId/receipts/ocr-jobs/:jobId/apply`

## Pantry + recipes
- Pantry list/add:
  - `GET /households/:householdId/pantry`
  - `POST /households/:householdId/pantry`
- Recipe suggest:
  - `POST /households/:householdId/recipes/suggest`
- Recipe -> list:
  - `POST /households/:householdId/recipes/:recipeKey/add-to-list`

## Admin/ops surfaces
- Pricing pipeline/cache:
  - `GET /pricing/pipeline`
  - `GET /pricing/cache`
  - `POST /pricing/staging`
  - `POST /pricing/promote`
- Security/Audit: `GET /security/audit-log`
- Observability metrics: `GET /metrics`
