# SmartCart Alerting Rules (Baseline)

## API latency
- Alert: `smartcart_api_p95_ms > 750ms` for 10m.
- Severity: warning.
- Source: `/metrics` snapshot (or future Prometheus export).

## API 5xx rate
- Alert: `smartcart_api_error_5xx_rate > 2%` for 5m.
- Severity: critical.

## OCR queue depth
- Alert: `ocr_queue_total > 100` OR `ocr_dead_letter > 10` for 15m.
- Severity: warning (depth), critical (dead-letter spike).

## AI abuse / throttling
- Alert: `rate_limit_ai` events > 200 / 15m.
- Severity: warning.
