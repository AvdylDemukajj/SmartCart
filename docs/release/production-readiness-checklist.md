# Production Readiness Checklist

## Platform
- [ ] Postgres + Drizzle migrations applied in target environment.
- [ ] RLS policies validated with tenant isolation tests.
- [ ] Redis cache configured (replace in-memory cache where needed).
- [ ] Secrets configured via environment and rotation plan tested.

## Security
- [ ] JWT issuer/audience/expiry constraints finalized for Clerk integration.
- [ ] Rate-limit thresholds calibrated for production traffic.
- [ ] Abuse/audit log retention policy defined.

## Reliability & Ops
- [ ] Alerting thresholds configured from `docs/ops/alerting-rules.md`.
- [ ] Incident runbook reviewed and shared with on-call.
- [ ] `/metrics` integrated with monitoring stack.

## QA & Verification
- [ ] Integration + contract tests passing in CI.
- [ ] Load test baseline executed and documented.
- [ ] Staging smoke tests passing after deploy.

## Go-live
- [ ] Rollback plan documented.
- [ ] Feature flags/defaults reviewed.
- [ ] Post-deploy verification checklist executed.
