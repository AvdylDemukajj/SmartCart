# SmartCart Backend — Task List (Master Roadmap)

Ky roadmap e ndan backend-in në hapa të menaxhueshëm që të ndërtohet gradualisht dhe saktë.

## Phase 0 — Import & Baseline
- [x] Krijo bazën e backend-it në këtë repository.
- [ ] Importo kodin nga `grocify-expo` në këtë repo si referencë frontend/shared contracts.
- [ ] Mappo endpoint-et backend me flow-et e frontend-it nga repo referencë.
- [ ] Shto CI bazike për lint/test.

## Phase 1 — Core Platform Foundations
- [x] Health endpoint.
- [x] Households CRUD bazike + membership.
- [x] Tenant isolation në nivel aplikacioni (`x-user-id`).
- [~] Migrim nga pseudo-auth në Clerk JWT (në progres: Bearer dev token + header auth).
- [x] Shto request-id middleware + structured logs.

## Phase 2 — Shopping Lists Real-Time
- [x] CRUD bazike për items dhe activity log.
- [x] Auto-categorization për item names.
- [x] Real-time stream endpoint (SSE) për household events.
- [x] Optimistic concurrency me `version` në list items.
- [ ] WebSocket gateway (opsionale) krahas SSE.

## Phase 3 — Pricing & Flyers Engine
- [x] Endpoint për pricing estimate sipas store.
- [x] Endpoint për flyers hints.
- [x] `prices_staging` ingestion API.
- [x] Validation pipeline staging -> live.
- [x] Canonical product matching + confidence scores.
- [~] Cache layer (Redis) për totals me TTL (në progres: in-memory TTL cache aktive).

## Phase 4 — Receipts & Budget
- [x] Manual receipt ingestion endpoint.
- [x] Budget tracking + update.
- [x] Auto-mark list items from receipts.
- [~] Presigned upload endpoint (S3/R2) (në progres: simulated upload URL endpoint).
- [~] OCR queue me BullMQ (në progres: in-memory OCR job queue + states).
- [ ] Manual correction flow për OCR failures.

## Phase 5 — Pantry & AI Recipes
- [x] Pantry endpoints bazike.
- [x] Recipe suggestions endpoint (stub logic).
- [x] Free-tier rate limiting (3/day).
- [ ] Lidhje me model AI real.
- [ ] Prompt templates + response cache.
- [ ] Recipe -> shopping list ingredient expansion.

## Phase 6 — Data Layer Migration (Postgres + Drizzle + RLS)
- [x] SQL draft schema fillestare.
- [ ] Drizzle schema + migrations.
- [ ] Repository pattern (store -> db service).
- [ ] Enable RLS në tabelat tenant-bound.
- [ ] Integration tests për tenant data bleed prevention.

## Phase 7 — Security Hardening
- [ ] JWT validation/rotation.
- [ ] Rate limits globale dhe për endpoint AI.
- [ ] Input schema validation të plotë (zod/class-validator).
- [ ] Abuse detection + audit log.
- [ ] Secrets management policy.

## Phase 8 — Observability & Ops
- [ ] Metrics (p95 latency, queue depth, error rate).
- [ ] Trace correlation API -> workers -> DB.
- [ ] Alerting rules.
- [ ] Runbooks për incidents.

## Phase 9 — QA & Release
- [x] Integration tests bazike për flows kryesore.
- [ ] Contract tests me frontend clients.
- [ ] Load tests (k6/artillery).
- [ ] Staging deployment + smoke tests.
- [ ] Production readiness checklist.

## Current sprint (implemented now)
- [x] Real-time SSE stream endpoint për household activity.
- [x] Event emitter layer në store.
- [x] Test i dedikuar për stream event delivery.
- [x] Dokumentim i task list master roadmap.
- [x] Request-id + structured logging bazik.
- [x] Dev bearer token auth support.
- [x] Version conflict handling (409).
- [x] Pricing staging + promote endpoints with validation.
- [x] Pricing canonical matching + confidence scores.
- [x] In-memory TTL cache për pricing estimate.
- [x] Simulated presigned upload + OCR jobs endpoints.

