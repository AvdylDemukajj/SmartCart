# SmartCart B3 Threat Model + Abuse Controls

## Scope (P1 B3.x)
- API abuse vectors (auth bypass, rate-limit evasion, payload amplification, replay abuse).
- Supply-chain risk (dependency CVEs, container image CVEs).
- Audit trail trust (tamper-evidence and retention compliance).

## Threat model (STRIDE-oriented)

### 1) Spoofing / Privilege abuse
- **Threat:** non-admin actor attempts to access audit endpoints.
- **Control:** JWT claims based admin gate (`role` / `permissions`) + explicit forbid events in audit log.
- **Verification:** abuse suite and server tests for forbidden access + admin claim paths.

### 2) Tampering (audit trail)
- **Threat:** in-memory or persisted audit entries altered after write.
- **Control:** hash chain (`prevHash`, `hash`) per entry with stable payload hashing.
- **Verification:** integrity endpoint `/security/audit-log/integrity` returns 409 on tamper.

### 3) Repudiation
- **Threat:** actor disputes critical actions.
- **Control:** immutable-ish append model + requestId/userId/path/reason fields.

### 4) Information disclosure
- **Threat:** oversized payload / malformed retries to probe internals.
- **Control:** strict payload validation, replay token constraints, bounded body size.

### 5) Denial of service
- **Threat:** request floods, retry storms, cache stampede.
- **Control:** global/AI/smart-input rate limits + OCR backoff/replay dedupe + cache coalescing.

### 6) Elevation of privilege via vulnerable dependencies/images
- **Threat:** exploitable CVEs in npm tree or runtime image.
- **Control:** CI security gates (`npm audit`, Trivy FS+image) fail on HIGH/CRITICAL.

## Abuse suite (B3.1)
- Oversized request rejection (413).
- Invalid replay token rejection (400).
- Audit tamper detection via integrity endpoint (409).

## Security gates (B3.2)
- Workflow: `.github/workflows/security-gates.yml`
  - `npm audit --audit-level=high`
  - Trivy filesystem scan (HIGH/CRITICAL)
  - Trivy image scan (HIGH/CRITICAL)
  - dedicated abuse test execution

## Audit integrity + retention automation (B3.3)
- Hash-chain integrity check endpoint: `GET /security/audit-log/integrity`.
- Retention prune endpoint: `POST /security/audit-log/retention/prune`.
- Automation script: `scripts/audit-log-maintenance.mjs`.
- Retention policy knobs:
  - `AUDIT_LOG_RETENTION_DAYS` (default 90)
  - `AUDIT_LOG_MAX_ENTRIES` (default 500)
  - `AUDIT_LOG_INTEGRITY_SALT`

