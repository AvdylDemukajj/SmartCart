# SmartCart Backend — Task List (Master Roadmap)

Ky roadmap e ndan backend-in në hapa të menaxhueshëm që të ndërtohet gradualisht dhe saktë.

## Phase 0 — Import & Baseline
- [x] Krijo bazën e backend-it në këtë repository.
- [ ] Importo kodin nga `grocify-expo` në këtë repo si referencë frontend/shared contracts.
- [x] Mappo endpoint-et backend me flow-et e frontend-it nga repo referencë (draft map në `docs/frontend-backend-endpoint-map.md`).
- [x] Shto CI bazike për lint/test.

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
- [x] WebSocket gateway (opsionale) krahas SSE.

## Phase 3 — Pricing & Flyers Engine
- [x] Endpoint për pricing estimate sipas store.
- [x] Endpoint për flyers hints.
- [x] `prices_staging` ingestion API.
- [x] Validation pipeline staging -> live.
- [x] Canonical product matching + confidence scores.
- [x] Cache layer (Redis) për totals me TTL (fallback: in-memory cache).

## Phase 4 — Receipts & Budget
- [x] Manual receipt ingestion endpoint.
- [x] Budget tracking + update.
- [x] Auto-mark list items from receipts.
- [~] Presigned upload endpoint (S3/R2) (në progres: simulated upload URL endpoint).
- [~] OCR queue me BullMQ (në progres: in-memory OCR job queue + states).
- [x] Manual correction flow për OCR failures.

## Phase 5 — Pantry & AI Recipes
- [x] Pantry endpoints bazike.
- [x] Recipe suggestions endpoint (stub logic).
- [x] Free-tier rate limiting (3/day).
- [~] Lidhje me model AI real (OpenAI provider optional + stub fallback).
- [x] Prompt templates + response cache.
- [x] Recipe -> shopping list ingredient expansion.

## Phase 6 — Data Layer Migration (Postgres + Drizzle + RLS)
- [x] SQL draft schema fillestare.
- [x] Drizzle schema + migrations.
- [x] Repository pattern (store -> db service) (app repository abstraction + pricing repository).
- [x] Enable RLS në tabelat tenant-bound.
- [x] Integration tests për tenant data bleed prevention.

## Phase 7 — Security Hardening
- [x] JWT validation/rotation.
- [x] Rate limits globale dhe për endpoint AI.
- [x] Input schema validation të plotë (framework applied across endpoints).
- [x] Abuse detection + audit log.
- [x] Secrets management policy.

## Phase 8 — Observability & Ops
- [x] Metrics (p95 latency, queue depth, error rate).
- [x] Trace correlation API -> workers -> DB (request-id -> repository db trace + OCR worker trace).
- [x] Alerting rules.
- [x] Runbooks për incidents.

## Phase 9 — QA & Release
- [x] Integration tests bazike për flows kryesore.
- [x] Contract tests me frontend clients.
- [~] Load tests (k6/artillery) (në progres: smoke scripts `backend/load/*`).
- [~] Staging deployment + smoke tests (në progres: `scripts/smoke-staging.sh` + playbook).
- [x] Production readiness checklist.

## Phase 10 — TypeScript Enterprise Transition
- [x] V2 typed backend skeleton (`src-v2`) me architecture layering (`config/core/application/modules`).
- [x] Type-safe configuration loading + validation.
- [x] Router abstraction me request context dhe auth-aware route contracts.
- [x] Build scripts (`start:v2`, `typecheck:v2`) për gradual migration strategy.

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
- [x] OCR retry/dead-letter + manual correction flow.
- [x] Recipe cache + recipe-to-list expansion API.
- [x] Phase 6 scaffold: Drizzle schema + initial migration + pricing repository split.

Reference delivery plan: `docs/planning/sprint-plan.md`.
