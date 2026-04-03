# SmartCart Backend

Backend API për SmartCart AI me module MVP + foundations për features e PRD-së:

- Households & members
- Shopping list + categorization + activity log
- Real-time stream (SSE) për activity events
- WebSocket household sync endpoint (`/ws/households/:householdId`)
- Pricing estimate + flyers hints
- Pricing staging -> promotion workflow me validim bazik
- Canonical product matching + confidence scores (pricing pipeline)
- Pricing estimate cache me TTL 6 orë + cache-audit counters (hit/miss/coalesced)
- Receipts ingestion (manual payload) + budget updates
- Presigned upload URL (simuluar) + OCR jobs workflow
- OCR retry + dead-letter + manual correction flow
- OCR retry backoff + replay-token dedupe controls for resilience
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
- Global + AI endpoint rate limiting (distributed token-bucket when cache backend is shared, fixed-window fallback)
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
- `SECURITY_AUDIT_ADMIN_USERS` (opsionale, listë comma-separated e user IDs admin)
  - Alternative: JWT claims (`role`, `roles`, `permissions`) për admin access te audit endpoints.
- `REDIS_URL` (opsionale për real cache backend)
- `AI_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL` (opsionale për AI provider real)
- `ALLOW_INMEMORY_CACHE_FALLBACK=1` (opsionale; lejon cache fallback në prod kur Redis mungon)
- `MAX_REQUEST_BODY_BYTES` (default 1048576)
- `HTTP_REQUEST_TIMEOUT_MS` (default 30000)
- `HTTP_HEADERS_TIMEOUT_MS` (default 31000)
- `WS_ALLOWED_ORIGINS` (opsionale, comma-separated origins allowlist)
- `MAX_WS_CONNECTIONS` (default 5000)
- `MAX_WS_CONNECTIONS_PER_USER` (default 20)
- `WS_IDLE_TIMEOUT_MS` (default 120000)
- `WS_HEARTBEAT_INTERVAL_MS` (default 30000)
- `WS_HEARTBEAT_GRACE_MS` (default 90000)
- `MAX_WS_FRAME_BYTES` (default 16384; close code `1009` kur frame është shumë i madh)
- `AUDIT_LOG_RETENTION_DAYS` (default 90)
- `AUDIT_LOG_MAX_ENTRIES` (default 500)
- `AUDIT_LOG_INTEGRITY_SALT` (**required in production**; pa këtë serveri nuk nis)
- `ENABLE_DISTRIBUTED_RATE_LIMITER` (default `true`; përdor token-bucket state në cache shared)
- `OTEL_EXPORTER_OTLP_ENDPOINT` (opsionale; kur vendoset aktivizohet OTLP span export)
- `OTEL_SERVICE_NAME` (default `smartcart-backend`)

## API Endpoints

### System
- `GET /health`
- `GET /metrics`
- `GET /security/audit-log` (admin only)
- `GET /security/audit-log/integrity` (admin only)
- `POST /security/audit-log/retention/prune` (admin only)
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

Load test profiles (CI gate ready):
- `load/k6-baseline.js` (baseline gate with p95/p99 thresholds)
- `load/artillery-stress.yml` (stress gate + JSON threshold validation)
- `load/k6-soak.js` (soak gate with p95/p99 thresholds)
- `load/k6-smoke.js` and `load/artillery-smoke.yml` (quick local smoke)

Nightly load gate workflow:
- `.github/workflows/backend-nightly-load.yml`


Security gates workflow:
- `.github/workflows/security-gates.yml`
  - dependency scan: `npm audit --audit-level=high`
  - image/fs scan: Trivy HIGH/CRITICAL (gate)
  - SAST: CodeQL
  - Secret scanning: Gitleaks
  - SBOM generation (SPDX) + Cosign keyless signing/verification
  - requires repo variable `NODE_BASE_DIGEST` (sha256 digest for base image pin)
  - abuse suite: `backend/test/abuse-suite.test.js`

Wave 3 resilience/governance drills:
- `node ../scripts/run-chaos-drill.mjs`
- `node ../scripts/run-backup-restore-drill.mjs`
- `node ../scripts/run-multi-zone-readiness.mjs`
- Data governance tests: `npm run test:governance`

Threat model + abuse controls doc:
- `../docs/security/threat-model-b3.md`

Audit log maintenance workflow:
- `.github/workflows/audit-log-maintenance.yml`

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
