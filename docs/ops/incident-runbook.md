# SmartCart Incident Runbook (Baseline)

## 1) Triage
1. Check `/health` and `/metrics`.
2. Inspect recent logs by `requestId` and error code.
3. Inspect `/security/audit-log` for abuse spikes.

## 2) API latency incident
1. Confirm p95 from `/metrics`.
2. Identify endpoint with highest `p95Ms`.
3. If OCR queue is high, pause OCR retries and drain queue.
4. Roll back latest deploy if regression is confirmed.

## 3) 5xx spike incident
1. Sample top error messages from structured logs.
2. Validate auth secret env variables (`AUTH_JWT_SECRET(S)`).
3. Verify upstream deps (DB/cache/service availability).
4. Apply mitigation (rate limit tightening, rollback, feature flag).

## 4) OCR backlog incident
1. Check `queueDepth` in `/metrics`.
2. Inspect dead-letter jobs and correction flow.
3. Temporarily reduce enqueue rate if needed.

## 5) Recovery + follow-up
1. Confirm metrics normalize for 30 minutes.
2. Record root cause and preventative action.
3. Update this runbook if any missing steps were discovered.
