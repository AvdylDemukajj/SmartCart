# SmartCart AI — Enterprise Sprint Plan (Backend-First)

## 1) Objective
This document finalizes the enterprise backend plan using multidisciplinary senior-team ownership. It consolidates:
1. All required backend functions.
2. All known corrections/adjustments needed to reach production readiness.
3. Sprint-by-sprint delivery plan to complete the project.

---

## 2) Current Status and Final Conclusions

### 2.1 Confirmed findings from repository analysis
- Backend contains a legacy JavaScript runtime with a parser-blocking defect in OCR retry area (`backend/src/store.js`) that prevents tests from executing reliably.
- A TypeScript V2 scaffold exists, but it is not yet a full NestJS architecture and does not cover all product modules.
- Security, queue durability, and operational controls are partially present but not at enterprise-level completion.
- CI is basic and does not yet enforce full quality gates (integration, load, security, migration checks).

### 2.2 Final conclusion
Project is at **foundation/MVP transition stage** and requires an orchestrated migration to a **NestJS + TypeScript canonical backend** with Postgres/Redis/BullMQ, strict tenant isolation, and release-grade QA/ops.

---

## 3) Team Model and Ownership

| Role | Primary Ownership |
|---|---|
| Senior Software Engineers | Domain services/controllers, API contracts, migration implementation |
| Senior Software Architects | System boundaries, module decomposition, NFR governance |
| Senior DevOps Engineers | CI/CD pipelines, release gates, artifact policy |
| Senior Cloud Engineers | Environment topology, scalability, managed services integration |
| Senior Solution Engineers | Cross-system integration and external provider orchestration |
| Senior Data Engineers | Ingestion pipelines, staging/live promotion, data quality controls |
| Senior Test Engineers | Test matrix, automation strategy, quality gates |
| Senior Database Engineers | Postgres schema, RLS, indexing, migration reliability |
| Senior Network Engineer | Ingress/egress controls, segmentation, API exposure policy |
| Senior Cyber Security Engineer | Threat model, auth hardening, abuse prevention, auditability |

---

## 4) Required Backend Functions (Target Catalog)

## 4.1 Auth & Access Control
- `validateClerkJwt(token)`
- `resolveAuthenticatedUser(request)`
- `authorizeHouseholdAccess(userId, householdId, action)`
- `enforceAdminAccess(userId, headers)`
- `recordSecurityAuditEvent(event)`

## 4.2 Households & Membership
- `createHousehold(ownerId, payload)`
- `listUserHouseholds(userId)`
- `inviteHouseholdMember(actorId, householdId, payload)`
- `acceptHouseholdInvite(userId, inviteToken)`
- `removeHouseholdMember(actorId, householdId, memberId)`

## 4.3 Shopping Lists & Real-Time Activity
- `listHouseholdItems(userId, householdId)`
- `addHouseholdItem(userId, householdId, payload)`
- `updateHouseholdItem(userId, householdId, itemId, payload)`
- `toggleHouseholdItemPurchased(userId, householdId, itemId, payload)`
- `listHouseholdActivity(userId, householdId, query)`
- `publishHouseholdEvent(householdId, event)`
- `streamHouseholdEvents(userId, householdId, transport)`

## 4.4 Pricing & Flyers
- `estimateHouseholdBasket(userId, householdId, query)`
- `listFlyerDeals(userId, householdId, query)`
- `ingestPricesStaging(payload, sourceMeta)`
- `validateStagedPrices(batchId)`
- `promoteStagedPrices(batchId, actorId)`
- `getPricingCacheDiagnostics(actorId)`

## 4.5 Receipts, OCR, and Budget
- `createReceiptUploadUrl(userId, householdId, payload)`
- `enqueueReceiptOcrJob(userId, householdId, payload)`
- `listReceiptOcrJobs(userId, householdId)`
- `retryReceiptOcrJob(userId, householdId, jobId)`
- `correctReceiptOcrJob(userId, householdId, jobId, payload)`
- `applyReceiptOcrResult(userId, householdId, jobId)`
- `setHouseholdBudget(userId, householdId, payload)`
- `getHouseholdBudget(userId, householdId)`
- `getBudgetAnalytics(userId, householdId, query)`

## 4.6 Pantry & AI Recipes
- `listPantryItems(userId, householdId)`
- `upsertPantryItem(userId, householdId, payload)`
- `suggestRecipes(userId, householdId, payload)`
- `addRecipeIngredientsToList(userId, householdId, recipeId, payload)`
- `enforceAiQuota(userId, plan)`
- `cacheAiSuggestion(cacheKey, value, ttl)`

## 4.7 Smart Inputs (Voice + Barcode)
- `parseVoiceInputToItems(userId, householdId, payload)`
- `resolveBarcodeToProduct(barcode, locale)`
- `addBarcodeProductToList(userId, householdId, payload)`

## 4.8 Observability & Operations
- `getServiceHealth()`
- `getMetricsSnapshot()`
- `getTraceReport(requestId, actorId)`
- `recordTelemetrySpan(context)`
- `recordQueueMetrics(queueStats)`

---

## 5) Required Corrections and Completions

## 5.1 Critical corrections (blockers)
1. Fix parser-breaking OCR retry duplication in legacy store logic.
2. Stop defaulting to mixed runtime; establish NestJS TS runtime as canonical.
3. Replace simulated/in-memory queues with durable BullMQ + Redis workers.

## 5.2 Security and compliance completions
1. Enforce Clerk JWT validation and production-safe token policy.
2. Enforce RLS-based tenant isolation for all tenant-bound tables.
3. Add full audit trail for security-sensitive and admin operations.
4. Apply route-level abuse controls and request hardening.

## 5.3 Data/platform completions
1. Complete Drizzle schema coverage for all product modules.
2. Add migration governance (forward-only, CI verification, rollback playbook).
3. Implement staging-to-live promotion governance for price ingestion.

## 5.4 QA and release completions
1. Expand CI to include lint/typecheck/unit/integration/contract/security/load checks.
2. Add environment promotion criteria (dev -> staging -> prod).
3. Add runbooks and incident drills (DB, queue, cache, auth incidents).

---

## 6) Agile Sprint Plan

## Sprint 0 — Stabilization and Baseline (1 week)
**Goal:** Make current system parse, boot, and testable.
- Fix OCR retry syntax defect.
- Restore green baseline tests for legacy paths.
- Freeze feature changes until baseline is stable.

**Owners:** Software Engineers, Test Engineers.
**Exit criteria:** Backend parses, tests run deterministically, defect register initialized.

## Sprint 1 — NestJS Core Platform (2 weeks)
**Goal:** Stand up canonical Nest runtime and cross-cutting platform concerns.
- Initialize Nest modules, global validation, exception filters, logging, request-id propagation.
- Implement auth guard scaffolding and health/metrics/trace endpoints.
- Add configuration module for environment-safe bootstrapping.

**Owners:** Software Engineers, Architects, Cyber Security Engineers.
**Exit criteria:** Nest app is canonical start path with core middleware/guards.

## Sprint 2 — Households + Lists + Real-Time (2 weeks)
**Goal:** Port collaboration core to Nest.
- Implement households/membership/list endpoints in Nest services.
- Add activity log and SSE/WebSocket delivery with tenant-safe channels.
- Add optimistic concurrency and conflict response consistency.

**Owners:** Software Engineers, Solution Engineers, Test Engineers.
**Exit criteria:** Functional parity for core lists + real-time collaboration.

## Sprint 3 — Postgres + Drizzle + RLS Hardening (2 weeks)
**Goal:** Move from in-memory reliance to production data layer.
- Finalize Drizzle schema and repositories for core modules.
- Enable and verify RLS policies across tenant-bound tables.
- Add DB integration tests and migration CI checks.

**Owners:** Database Engineers, Data Engineers, Software Engineers.
**Exit criteria:** Tenant-safe DB reads/writes verified by tests.

## Sprint 4 — Pricing/Flyers Pipeline (2 weeks)
**Goal:** Productionize pricing intelligence.
- Implement staging ingestion API with source metadata.
- Add validation/anomaly checks and controlled promotion to live.
- Add cache strategy and diagnostics for estimate endpoints.

**Owners:** Data Engineers, Solution Engineers, Software Engineers.
**Exit criteria:** Price ingestion and promotion fully governed with auditability.

## Sprint 5 — Receipt OCR + Budget + Workers (2 weeks)
**Goal:** Durable async processing and budget integration.
- Implement presigned upload flow and OCR queue (BullMQ).
- Add OCR retry/dead-letter/correction workflows.
- Integrate OCR outputs with budget and list auto-marking.

**Owners:** Software Engineers, Cloud Engineers, DevOps Engineers.
**Exit criteria:** OCR pipeline durable, observable, and recoverable.

## Sprint 6 — Pantry + AI Recipes + Quotas (2 weeks)
**Goal:** Deliver AI-assisted kitchen workflows safely.
- Implement pantry freshness logic, recipe suggestions, and recipe-to-list expansion.
- Enforce AI quota and cost-control policies.
- Add response caching and prompt/template version controls.

**Owners:** Software Engineers, Cyber Security Engineers, Data Engineers.
**Exit criteria:** AI features production-safe with usage controls.

## Sprint 7 — Smart Inputs (Voice + Barcode) (2 weeks)
**Goal:** Complete advanced input features.
- Add voice-to-items parsing endpoint.
- Add barcode lookup and list insertion flow.
- Add locale-aware catalog resolution for Kosovo/Albania/Germany.

**Owners:** Solution Engineers, Software Engineers, Test Engineers.
**Exit criteria:** Voice and barcode flows integrated end-to-end.

## Sprint 8 — Enterprise Hardening + Go-Live (2 weeks)
**Goal:** Final operational readiness and launch decision.
- Execute full security, load, and chaos drills.
- Finalize SLOs, alerts, and incident runbooks.
- Run staging soak tests and production readiness checklist.

**Owners:** DevOps Engineers, Cloud Engineers, Network Engineer, Cyber Security Engineer, Test Engineers.
**Exit criteria:** Go-live sign-off by architecture, security, QA, and operations.

---

## 7) Cross-Sprint Quality Gates (Mandatory)
- Type safety: 100% Nest runtime code in TypeScript.
- Security: authz tests + RLS bleed-prevention tests pass.
- Reliability: queue retry/dead-letter scenarios validated.
- Performance: API p95 and queue latency thresholds met.
- Release: all CI gates green before environment promotion.

---

## 8) Definition of Done (Project Completion)
Project is considered complete only when:
1. Canonical backend is NestJS + TypeScript with no production reliance on legacy JS runtime.
2. All functional modules in Section 4 are implemented and tested.
3. Security, RLS, auditability, and abuse controls are enforced in production configuration.
4. CI/CD, observability, runbooks, and rollout/rollback procedures are validated.
5. Staging and production readiness checklists are fully signed off.

Execution board: `docs/planning/sprint-task-board.md`.
Sprint 1 kickoff board: `docs/planning/sprint-1-kickoff.md`.
Sprint 2 kickoff board: `docs/planning/sprint-2-kickoff.md`.
Sprint 3 kickoff board: `docs/planning/sprint-3-kickoff.md`.
Sprint 4 kickoff board: `docs/planning/sprint-4-kickoff.md`.
Sprint 5 kickoff board: `docs/planning/sprint-5-kickoff.md`.
Sprint 6 kickoff board: `docs/planning/sprint-6-kickoff.md`.
Sprint 7 kickoff board: `docs/planning/sprint-7-kickoff.md`.
Sprint 8 kickoff board: `docs/planning/sprint-8-kickoff.md`.
Post-sprint code review: `docs/planning/post-sprint-code-review.md`.
Sprint 8 closure report: `docs/planning/sprint-8-closure.md`.
Final senior verification report: `docs/planning/final-senior-verification-report.md`.
Sprint code completion audit: `docs/planning/sprint-code-completion-audit.md`.
