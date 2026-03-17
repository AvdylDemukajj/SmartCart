# Staging Smoke Tests

## Required env
- `BASE_URL` (e.g. `https://staging.api.smartcart.app`)
- `TEST_USER_ID` (default: `smoke-user`)

## Run
```bash
BASE_URL=https://staging.example.com TEST_USER_ID=smoke-user ./scripts/smoke-staging.sh
```

## Smoke coverage
- Health and metrics endpoints.
- Household create/list.
- Item create/list.
- Budget read/write.
- Pricing estimate.
