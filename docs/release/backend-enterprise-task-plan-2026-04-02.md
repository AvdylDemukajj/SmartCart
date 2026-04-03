# Backend Enterprise Task Plan (Post-Audit) — 2026-04-02

## Qëllimi
Ky plan e kthen auditimin në **taska ekzekutues** për ta çuar backend-in në nivel **senior + enterprise-grade production readiness**.

> Shënim profesional: në inxhinieri nuk ekziston garanci absolute “100% e përkryer”; objektivi realist është **risk shumë i ulët + kontrolle të forta + verifikim të matshëm**.

---

## Team i zgjeruar (multi-senior)

Për secilin domain kemi 2–3+ role aktive:

1. **Core Platform Squad**
   - Senior Software Engineer (x3)
   - Senior Software Architect (x2)
   - Senior Solution Engineer (x2)
   - Senior Solution Architect (x1)

2. **Security & Reliability Squad**
   - Senior Cyber Security Engineer (x3)
   - Senior DevOps Engineer (x2)
   - Senior Cloud Engineer (x2)
   - Senior Network Engineer (x2)

3. **Data & Quality Squad**
   - Senior Data Engineer (x2)
   - Senior Database Engineer (x3)
   - Senior Test Engineer (x3)

---

## Program Phases

- **Phase A (P0): Critical hardening before enterprise go-live**
- **Phase B (P1): Scale and operational maturity**
- **Phase C (P2): Optimization + resilience excellence**

## P0 Wave 1 (Implemented in codebase)

- [x] JWT-aware auth context added to support claims-based admin authorization checks.
- [x] `/security/audit-log` and `/trace/:requestId` admin access now supports role/permissions claims from JWT.
- [x] HTTP request body size protection (`413`) added via configurable max body bytes.
- [x] HTTP request/header timeout guards added at server level.
- [x] WebSocket hardening baseline added: origin allowlist, max connections, protocol version check, idle timeout.
- [x] Redis strict mode support added for production dependency enforcement (`createCacheFromEnv({ strict: true })`).

---

## Phase A — P0 (Must complete before go-live)

### Stream A1 — Architecture modularization (Runtime core)

**A1.1** Split `server.js` routes into domain modules (`households`, `items`, `pricing`, `receipts`, `recipes`, `admin`, `realtime`).
- Owners: SSE(x2), SSA(x1)
- Acceptance criteria:
  - Routing table per domain + shared middleware pipeline.
  - `server.js` reduced to bootstrap/wiring only.
  - No API contract break against existing tests.

**A1.2** Extract service boundaries from `SmartCartStore`.
- Owners: SSE(x2), SSA(x1), Solution Architect(x1)
- Acceptance criteria:
  - Separate services: HouseholdService, ListService, PricingService, Receipt/OCRService, RecipeService, AuditService.
  - Dependency graph documented.

**A1.3** Introduce centralized error model and standard error envelope.
- Owners: SSE(x1), Solution Engineer(x1)
- Acceptance criteria:
  - Stable `error.code`, `error.message`, `requestId` envelope.
  - Mapped error taxonomy doc + compatibility tests.

---

### Stream A2 — Security controls (production-grade)

**A2.1** Replace static `x-admin-key` pattern with claims-based admin authorization.
- Owners: Security(x2), Solution Architect(x1)
- Acceptance criteria:
  - Admin access granted only via signed token claims/roles.
  - Short-lived credentials and aud/iss constraints enforced.

**A2.2** WebSocket hardening pack.
- Owners: Security(x1), Network(x1), SSE(x1)
- Acceptance criteria:
  - Origin allowlist.
  - Heartbeat ping/pong + idle timeout.
  - Max frame size and connection limits.
  - Structured close codes.

**A2.3** Security headers + strict request size/timeouts.
- Owners: Security(x1), DevOps(x1)
- Acceptance criteria:
  - Hardened defaults for request body limits, header sanity, timeout budget.
  - Security regression tests added.

**A2.4** Secrets governance baseline.
- Owners: Security(x1), Cloud(x1), DevOps(x1)
- Acceptance criteria:
  - No plaintext secrets in env files for prod.
  - Rotation runbook + automatic secret version rollout.

---

### Stream A3 — Data/DB correctness gates

**A3.1** Mandatory DB-first CI lane with ephemeral Postgres.
- Owners: DBE(x1), Test(x1), DevOps(x1)
- Acceptance criteria:
  - `DATABASE_URL` integration lane required for merge to main.
  - Skipped DB tests become blocking failures in protected branch CI.

**A3.2** Migration safety pipeline.
- Owners: DBE(x2), Test(x1)
- Acceptance criteria:
  - Up/down compatibility checks.
  - Schema drift detector against canonical schema.
  - Rollback simulation passes.

**A3.3** RLS policy verification expansion.
- Owners: DBE(x1), Security(x1), Test(x1)
- Acceptance criteria:
  - Negative tests for cross-tenant reads/writes on every tenant table.

---

### Stream A4 — Reliability and fail-safe behavior

**A4.1** Strict production dependency policy (DB/Redis).
- Owners: DevOps(x1), Cloud(x1), SSE(x1)
- Acceptance criteria:
  - In prod tier, startup fails if required dependencies unavailable.
  - Controlled emergency override with explicit alert + audit entry.

**A4.2** Durable observability baseline.
- Owners: DevOps(x1), Data(x1), SSE(x1)
- Acceptance criteria:
  - Metrics exported to central backend (Prometheus/OpenTelemetry collector).
  - Request-id propagated through all critical workflows.

**A4.3** SLO definition and alerting gates.
- Owners: DevOps(x1), Solution Engineer(x1), Test(x1)
- Acceptance criteria:
  - SLOs defined: latency/error/availability.
  - Alert routing tested via game-day dry run.

---

## Phase B — P1 (Scale and operational maturity)

### Stream B1 — Runtime modernization to V2

**B1.1** Cutover plan from `src/` to `src-v2/` by domain increments.
- Owners: SSA(x1), SSE(x2)
- Acceptance criteria:
  - Domain-by-domain migration checklist complete.
  - Feature parity matrix signed-off.

**B1.2** Shared middleware framework (auth, rate-limit, audit, validation).
- Owners: SSE(x2), Solution Engineer(x1)
- Acceptance criteria:
  - No duplicated auth/validation logic in handlers.

---

### Stream B2 — Performance engineering

**B2.1** Baseline + stress + soak test profiles.
- Owners: Test(x2), DevOps(x1), Network(x1)
- Acceptance criteria:
  - k6/artillery pipelines in CI nightly.
  - Throughput and p95/p99 thresholds enforced.

**B2.2** Cache efficiency and invalidation audit.
- Owners: Data(x1), SSE(x1), Cloud(x1)
- Acceptance criteria:
  - Hit ratio targets defined and met.
  - Cache stampede mitigation implemented.

**B2.3** Queue/workflow resilience for OCR-like async jobs.
- Owners: SSE(x1), DevOps(x1), Data(x1)
- Acceptance criteria:
  - Backoff strategy, dead-letter policy, replay controls.

---

### Stream B3 — Enterprise security depth

**B3.1** Threat modeling + abuse case suite.
- Owners: Security(x2), Solution Architect(x1)
- Acceptance criteria:
  - STRIDE/LINDDUN style model documented.
  - Abuse scenarios linked to controls/tests.

**B3.2** Dependency and image scanning gates.
- Owners: Security(x1), DevOps(x1)
- Acceptance criteria:
  - High/critical vulns block release until triaged/remediated.

**B3.3** Audit log integrity and retention policy automation.
- Owners: Security(x1), Data(x1), DBE(x1)
- Acceptance criteria:
  - Tamper-evident audit storage strategy.
  - Retention + purge jobs validated.

---

## Phase C — P2 (Optimization + resilience excellence)

### Stream C1 — Resilience engineering

**C1.1** Chaos tests for DB/Redis/network partitions.
- Owners: DevOps(x1), Cloud(x1), Network(x1), Test(x1)
- Acceptance criteria:
  - Failure injection scenarios pass with bounded degradation.

**C1.2** Multi-zone deployment readiness.
- Owners: Cloud(x2), DevOps(x1)
- Acceptance criteria:
  - Zonal failure simulation and RTO/RPO targets satisfied.

---

### Stream C2 — Data governance and compliance readiness

**C2.1** Data classification and PII minimization.
- Owners: Data(x1), Security(x1), Solution Architect(x1)
- Acceptance criteria:
  - PII inventory, masking rules, and retention-by-class policy enforced.

**C2.2** Backup/restore drills.
- Owners: DBE(x1), DevOps(x1), Cloud(x1)
- Acceptance criteria:
  - Restore tests executed on schedule with evidence.

---

### Stream C3 — Cost and capacity optimization

**C3.1** Capacity model + autoscaling policies.
- Owners: Cloud(x1), DevOps(x1), Network(x1)
- Acceptance criteria:
  - Forecasted load bands and auto-scaling thresholds documented and validated.

**C3.2** Cost guardrails and dashboards.
- Owners: Cloud(x1), Data(x1)
- Acceptance criteria:
  - Service-level cost budgets, alerts, and monthly optimization review.

---

## Definition of Done (Enterprise Gate)

Ky backend konsiderohet enterprise-ready vetëm kur plotësohen **të gjitha**:

1. **Security Gate:** zero unresolved critical findings + hardening controls aktive.
2. **Reliability Gate:** SLOs green për një periudhë të qëndrueshme pre-prod.
3. **Quality Gate:** unit/integration/contract/DB/load suites kalojnë pa skip kritike.
4. **Data Gate:** migration rollback tested + RLS negative tests passing.
5. **Operations Gate:** on-call runbooks, alerting, dashboards, disaster drills validated.
6. **Architecture Gate:** modular boundaries enforced dhe runtime i stabilizuar.

---

## Suggested execution timeline

- **Weeks 1–3:** Complete A1–A4 (P0 hardening).
- **Weeks 4–7:** Execute B1–B3 (P1 scale/security maturity).
- **Weeks 8–10:** Execute C1–C3 (P2 resilience/optimization).

---

## Tracking format (recommended)

Për çdo task përdor këtë template:

- `Task ID`
- `Owner(s)`
- `Priority (P0/P1/P2)`
- `Dependencies`
- `Risk if delayed`
- `Acceptance criteria`
- `Evidence link (test report, dashboard, PR, runbook)`
- `Status (Not started/In progress/Done)`
