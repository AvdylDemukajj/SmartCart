# Production Readiness Checklist

## Platform
- [x] Postgres + Drizzle migrations applied in target environment.
- [x] RLS policies validated with tenant isolation tests.
- [x] Redis cache configured (replace in-memory cache where needed).
- [x] Secrets configured via environment and rotation plan tested.

## Security
- [x] JWT issuer/audience/expiry constraints finalized for Clerk integration.
- [x] Rate-limit thresholds calibrated for production traffic.
- [x] Abuse/audit log retention policy defined.

## Reliability & Ops
- [x] Alerting thresholds configured from `docs/ops/alerting-rules.md`.
- [x] Incident runbook reviewed and shared with on-call.
- [x] `/metrics` integrated with monitoring stack.

## QA & Verification
- [x] Integration + contract tests passing in CI.
- [x] Load test baseline executed and documented.
- [x] Staging smoke tests passing after deploy.

## Go-live
- [x] Rollback plan documented.
- [x] Feature flags/defaults reviewed.
- [x] Post-deploy verification checklist executed.
