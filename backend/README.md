# SmartCart Backend

Backend API për SmartCart AI me module MVP + foundations për features e PRD-së:

- Households & members
- Shopping list + categorization + activity log
- Real-time stream (SSE) për activity events
- WebSocket household sync endpoint (`/ws/households/:householdId`)
- Pricing estimate + flyers hints
- Pricing staging -> promotion workflow me validim bazik
- Canonical product matching + confidence scores (pricing pipeline)
- Pricing estimate cache me TTL 6 orë
- Receipts ingestion (manual payload) + budget updates
- Presigned upload URL (simuluar) + OCR jobs workflow
- OCR retry + dead-letter + manual correction flow
- Pantry tracking
- Recipe suggestions (AI provider-ready: OpenAI fallback to stub) + rate limiting (3/ditë për user)
- Recipe prompt templates + response cache (TTL)
- Recipe -> shopping list ingredient expansion endpoint
- Request-id dhe structured logs bazike
- Optimistic concurrency bazike në list items (`version`)
- Drizzle schema + migration scaffold (Phase 6 foundation)
- Full app repository abstraction (households/lists/budget/receipts/pantry/ocr)
- Repository pattern fillestar (pricing repository i ndarë)
- JWT auth verification (HS256) me secret rotation (`AUTH_JWT_SECRETS`)
- Global + AI endpoint rate limiting (fixed-window)
- Security audit log endpoint (`/security/audit-log`)
- RLS migration policies për tabelat tenant-bound
- Observability metrics endpoint (`/metrics`) me p95/error-rate/queue-depth
- Redis-backed cache (when `REDIS_URL` is configured)
- OCR trace correlation fields (`apiRequestId`, `workerRunId`, `applyRequestId`)
- End-to-end trace endpoint (`/trace/:requestId`) for DB/worker correlation

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
- `Authorization: Bearer <jwt>` (HS256; `sub` claim)

Shënim production:
- Në `NODE_ENV=production`, `x-user-id` dhe `dev-user:*` bllokohen automatikisht.
- Përjashtim vetëm me `ALLOW_INSECURE_DEV_AUTH=true` (jo e rekomanduar).

Secrets për JWT verification/rotation:
- `AUTH_JWT_SECRET` ose `AUTH_JWT_SECRETS=oldSecret,newSecret`
- `AUTH_JWT_ISSUER` (opsionale, por e rekomanduar në production)
- `AUTH_JWT_AUDIENCE` (opsionale, por e rekomanduar në production)
- `SECURITY_AUDIT_ADMIN_USER_ID` (default `admin`)
- `SECURITY_AUDIT_ADMIN_KEY` (opsionale për akses me `x-admin-key`)
- `REDIS_URL` (opsionale për real cache backend)
- `AI_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL` (opsionale për AI provider real)

## API Endpoints

### System
- `GET /health`
- `GET /metrics`
- `GET /security/audit-log` (admin only)
- `GET /trace/:requestId` (admin only)

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
- `GET /ws/households/:householdId` (WebSocket upgrade endpoint)

### Budget & Receipts
- `GET /households/:householdId/budget`
- `PUT /households/:householdId/budget`
- `POST /households/:householdId/receipts`
- `GET /households/:householdId/receipts`
- `POST /households/:householdId/receipts/upload-url`
- `POST /households/:householdId/receipts/ocr-jobs`
- `GET /households/:householdId/receipts/ocr-jobs`
- `POST /households/:householdId/receipts/ocr-jobs/:jobId/retry`
- `PATCH /households/:householdId/receipts/ocr-jobs/:jobId/correct`
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
- `POST /households/:householdId/recipes/:recipeKey/add-to-list`
- `GET /recipes/cache`

### Smart Inputs contract notes
- `POST /households/:householdId/voice/parse` mbështet `contractVersion` (aktualisht `v1`).
- Voice response kthen `parsedItems[]` me `name`, `quantity`, `unit`, `confidence` + `ambiguousSegments`.
- Barcode response kthen `resolutionSource` (`catalog_exact` ose `catalog_prefix_fallback`) dhe `confidence`.
- Smart input endpoints kanë rate-limit të dedikuar (default: 20 kërkesa/min për user).

## Persistence
Runtime përdor automatikisht Postgres repository kur `DATABASE_URL` është i konfiguruar.
Në mungesë të `DATABASE_URL`, backend vazhdon me fallback in-memory për zhvillim lokal.
Skema SQL në `db/schema.sql` + migrimet në `db/migrations` mbulojnë bazën për Postgres + RLS.

Production policy:
- Në `NODE_ENV=production`, aplikacioni kërkon persistence real (Postgres).
- Për të lejuar fallback emergjent in-memory në production, vendos `ALLOW_INMEMORY_FALLBACK=1` (jo e rekomanduar).


## Data Layer Scaffold
- Drizzle schema: `db/drizzle/schema.ts`
- SQL migration scaffold: `db/migrations/0001_initial.sql`
- Repository abstraction (current): `src/repositories/price-repository.js`

See also: `../docs/security/secrets-management-policy.md`.

Ops docs:
- `../docs/ops/alerting-rules.md`
- `../docs/ops/incident-runbook.md`


Additional docs:
- `../docs/frontend-backend-endpoint-map.md`
- `../docs/release/staging-smoke-tests.md`
- `../docs/release/production-readiness-checklist.md`

Load test starters:
- `load/k6-smoke.js`
- `load/artillery-smoke.yml`

Release governance verification:
- `node ../scripts/verify-go-live.mjs`

## TypeScript V2 Architecture (Senior-grade foundation)
Për të adresuar shkallëzimin dhe maintainability në nivel senior, është shtuar një bazë e re `src-v2/` me Node.js + TypeScript dhe ndarje modulare:

- `config/` — typed env/config validation
- `core/http/` — router abstraction + request context
- `application/` — route registration/orchestration
- `modules/` — module services (health, households)

Run V2 server:

```bash
cd backend
npm run start:v2
```

Type check V2:

```bash
cd backend
npm run typecheck:v2
```

Sprint 1 core-platform hardening in V2 includes:
- standardized request logging with request-id + duration
- centralized HTTP error mapping
- auth method tracking (`x-user-id`, `bearer-dev-user`, `bearer-jwt`)
- environment policy to disable insecure dev auth outside development

Optional env for V2 security policy:
- `ALLOW_INSECURE_DEV_AUTH=false` (recommended for staging/production)

Ky është një hap tranzicioni drejt një arkitekture enterprise-ready pa prishur runtime-in ekzistues.
