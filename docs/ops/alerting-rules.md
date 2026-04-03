# SmartCart Alerting Rules (Wave 2)

## OpenTelemetry tracing SLOs
- Alert: `trace_export_failures_total > 0` for 10m.
- Severity: warning.
- Source: OTLP exporter health from backend logs/collector.

- Alert: `http_server_duration_p95_ms > 750` for 10m.
- Severity: warning.
- Source: `/metrics` and OTEL span latency dashboard.

- Alert: `http_server_duration_p99_ms > 1200` for 5m.
- Severity: critical.
- Source: OTEL dashboard and SLO burn-rate panels.

## API 5xx rate
- Alert: `smartcart_api_error_5xx_rate > 2%` for 5m.
- Severity: critical.

## OCR queue depth
- Alert: `ocr_queue_total > 100` OR `ocr_dead_letter > 10` for 15m.
- Severity: warning (depth), critical (dead-letter spike).

## Distributed rate-limit abuse
- Alert: `rate_limit_global` rejects > 500 / 5m.
- Severity: warning.

- Alert: `rate_limit_ai` rejects > 200 / 15m.
- Severity: warning.

- Alert: `rate_limit_smart_input` rejects > 300 / 10m.
- Severity: warning.

## Dashboards (recommended)
- `SmartCart API Golden Signals`: throughput, p95/p99, error rates.
- `SmartCart Tracing`: top slow endpoints, trace waterfall samples.
- `SmartCart Security`: rate-limit rejections, audit/integrity checks, auth failures.
