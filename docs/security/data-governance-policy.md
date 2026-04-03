# SmartCart Data Governance Policy (Wave 3)

## Scope
This policy defines enterprise controls for:
- PII inventory
- Data masking
- Retention by classification
- Chaos/resilience evidence expectations (backup/restore and multi-zone targets)

## Data classification model
- **public**: low-risk data suitable for broad sharing.
- **internal**: operational data with limited business sensitivity.
- **confidential**: user-related identifiers and sensitive business data.
- **restricted**: high-risk content (raw OCR text, sensitive reasons, potential secrets).

## PII inventory baseline
Reference implementation is maintained in `backend/src/data-governance.js`:
- household: `name`, `ownerId`
- member: `memberId`
- receipt: `ocrRawText`
- audit: `userId`, `reason`

## Masking controls
- Confidential fields must be partially masked in operational outputs.
- Restricted fields must be fully redacted (`***`) outside explicitly authorized paths.
- Masking behavior is unit-tested in `backend/test/data-governance.test.js`.

## Retention-by-class controls
Default retention windows:
- public: 365 days
- internal: 180 days
- confidential: 90 days
- restricted: 30 days

Retention policy tests are enforced in `backend/test/data-governance.test.js`.

## Resilience evidence requirements
Wave 3 requires drills with machine-readable evidence:
- Chaos drill: `scripts/run-chaos-drill.mjs`
- Backup/restore drill: `scripts/run-backup-restore-drill.mjs`
- Multi-zone readiness (RTO/RPO): `scripts/run-multi-zone-readiness.mjs`

## RTO/RPO targets
- Target RTO: <= 900 seconds
- Target RPO: <= 60 seconds

These targets are validated by the multi-zone readiness script and should be reviewed quarterly.
