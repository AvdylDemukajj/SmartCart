# SmartCart AI — Përmbledhje e Arkitekturës (Detajuar)

## 1) Qëllimi i sistemit
SmartCart AI ndërtohet si një platformë **multi-tenant** për familje (households), ku çdo household ka listat, buxhetin, faturat dhe historikun e vet privat. Objektivi teknik është:
- sinkronizim në kohë reale i listave,
- optimizim i kostos së blerjeve përmes engine-it të çmimeve,
- automatizim i proceseve të ngadalta (OCR/AI recipes) me workers,
- izolim i fortë i të dhënave me RLS në nivel databaze.

## 2) Arkitektura e lartë (High-Level)

### 2.1 Mobile Frontend (React Native + Expo)
- Shtresa UI për:
  - Shopping lists,
  - Budget & receipts,
  - Recipes & pantry,
  - Household settings.
- **TanStack Query** për server state (fetch, cache, revalidation).
- **Zustand** për app state (theme, local UI flags, preferences).
- Offline-friendly sjellje:
  - optimistic updates për list items,
  - queue lokale për veprime të shkurtra kur rrjeti mungon,
  - re-sync pas reconnect.

### 2.2 Backend API (NestJS + TypeScript)
- API qendrore për mobile app.
- AuthN/AuthZ me JWT nga Clerk.
- Vendos **tenant context** (user_id, household_id, role) për çdo request.
- Orkestron:
  - Postgres (Drizzle ORM),
  - Redis cache,
  - BullMQ queues,
  - event stream real-time (WebSocket/SSE).

### 2.3 Data Layer (PostgreSQL në Neon)
- Burimi i vetëm i së vërtetës.
- Multi-tenant me **Row-Level Security (RLS)**.
- Tabela live + tabela staging për ingestion të çmimeve.
- Audit/event logs për gjurmueshmëri.

### 2.4 Cache & Queues (Redis/Upstash)
- Cache për rezultate të shpeshta (price totals, recipes).
- Rate limiting për endpoint-et AI.
- BullMQ backend për jobs asinkrone (OCR, enrichment, matching).

### 2.5 Scraper Service (Python + Playwright)
- Proces i ndarë nga API (izolim operacional dhe sigurie).
- Mbledh flyers/çmime periodikisht.
- Shkruan fillimisht te `prices_staging`.
- Një proces validimi promovon vetëm rekordet e sakta në `prices_live`.

## 3) Bounded Contexts / Domain Modules

### 3.1 Identity & Membership
- Entitete: users, households, memberships, roles.
- Rregull: përdoruesi sheh vetëm household-et ku është anëtar.

### 3.2 Shopping Lists
- Entitete: lists, list_items, categories, item_status.
- Features:
  - CRUD me real-time updates,
  - auto-categorization (bulmet, mish, fruta/perime),
  - activity log (kush shtoi/fshiu/shënoi item).

### 3.3 Pricing & Flyers
- Entitete: stores, flyers, offers, prices_staging, prices_live.
- Llogaritje të totalit sipas dyqanit për listën aktive.
- Sinjalizime zbritjesh për artikujt relevantë.

### 3.4 Receipts & Budget
- Entitete: receipts, receipt_items, monthly_budgets, expense_breakdown.
- Pipeline:
  - upload foto me presigned URL,
  - OCR job asinkron,
  - parse & normalize,
  - update i buxhetit dhe listës.

### 3.5 Pantry & Recipes (AI)
- Entitete: pantry_items, consumption_estimates, recipe_suggestions.
- Features:
  - zero-waste nudges,
  - “recipe to shopping list” transform,
  - quota/rate-limit sipas planit.

## 4) Data Security & Isolation

### 4.1 Multi-Tenant Security Model
- JWT claim-e të detyrueshme: `sub`, `household_id` (ose household active), `role`.
- NestJS guard verifikon membership para çdo action.
- Postgres RLS:
  - `USING` kufizon leximin brenda household-it,
  - `WITH CHECK` kufizon shkrimin vetëm në household-in e autorizuar.

### 4.2 Siguri operacionale
- Scraper nuk ka akses direkt në tabelat live të përdoruesit.
- Input validation + schema enforcement në API.
- Secrets management (env vault) dhe rotacion periodik.

## 5) Real-Time Architecture

### 5.1 Event Model
Çdo ndryshim i listës gjeneron event me:
- `event_id`, `household_id`, `entity`, `entity_id`, `version`, `actor_id`, `timestamp`, `payload`.

### 5.2 Consistency Strategy
- Mobile bën optimistic update.
- Server ruan version të entitetit.
- Në konflikt (p.sh. dy update njëkohësisht), zbatohet version check + reconcile.
- Klienti mund të re-fetch entity në mismatch.

### 5.3 Delivery
- WebSocket (ose SSE) për push te anëtarët e household-it.
- Idempotency: event replay nuk duhet të krijojë duplikate në UI.

## 6) Pricing/Flyers Pipeline

### 6.1 Ingestion
1. Scraper merr burimet (faqe/flyers).
2. Parser nxjerr produktet/ofertat.
3. Data futet në `prices_staging` me metadata (`source`, `fetched_at`, confidence).

### 6.2 Validation
- outlier checks (0.00€, ndryshime ekstreme),
- duplicate collapse,
- unit normalization (kg/l/copë),
- confidence threshold për matching.

### 6.3 Promotion to Live
- Rekordet e validuara kalojnë në `prices_live`.
- API cache refresh me TTL të kontrolluar.

## 7) Receipt OCR Workflow

### 7.1 Upload Flow
1. App kërkon presigned URL.
2. App upload direkt në object storage (S3/R2).
3. Event njofton backend për file të ri.

### 7.2 Async Processing (BullMQ)
- States: `queued -> processing -> succeeded/failed -> retry/dead-letter`.
- Retry me exponential backoff.
- Në dështim final: manual correction flow në UI.

### 7.3 Output
- totali i faturës,
- item parsing,
- update i buxhetit mujor,
- auto-check i artikujve në listë kur ka match.

## 8) AI Governance & Cost Control
- Rate limiting për free tier (p.sh. 3 recipe generation/day).
- Quota mujore sipas household/plan.
- Response caching për prompt-e të përsëritura.
- Fallback model (më i lirë) kur afrohen limitet.
- Audit log për konsum token/cost.

## 9) Observability & Reliability

### 9.1 Logs / Metrics / Traces
- Structured logs me `request_id`, `household_id`, `user_id`.
- Metrics:
  - API p95 latency,
  - queue depth,
  - OCR success rate,
  - scraping freshness,
  - AI cost/day.
- Distributed tracing për flow kryesore.

### 9.2 Alerting
- Alert për:
  - rënie të sinkronizimit real-time,
  - queue backlog,
  - rritje anomalie në cost,
  - stale prices data.

## 10) MVP Milestones (Rekomandim)

### Faza 1 (Core Collaboration)
- Auth + households + memberships.
- Shopping lists real-time + activity log.
- RLS i plotë + testet e izolimit tenant.

### Faza 2 (Price Intelligence)
- stores/prices schema,
- scraper bazik + staging validation,
- list total by store + simple flyers badges.

### Faza 3 (Receipts & Budget)
- presigned upload,
- OCR queue pipeline,
- budget dashboard.

### Faza 4 (AI Pantry & Recipes)
- pantry tracking,
- zero-waste suggestions,
- recipe-to-list,
- cost controls të forta.

## 11) Risks kryesore dhe mitigime
- **Data bleed** -> RLS + integration tests tenant boundaries.
- **AI abuse/cost spike** -> hard quotas + alerts + model fallback.
- **Scraper bans** -> rotating proxies + decoupled infra.
- **Poisoned pricing data** -> staging + validation + promote-only-verified.
- **Concurrency conflicts** -> versioned events + idempotent client handling.

## 12) Përfundim
Arkitektura e propozuar është e duhur për objektivat e SmartCart AI dhe e shkallëzueshme për tregje të shumta. Prioriteti i parë duhet të jetë: **tenant security (RLS), real-time consistency, data contracts për pricing, dhe observability**, para se të rritet spektri i feature-ve AI.
