import { randomBytes } from 'node:crypto';

function randomHex(size) {
  return randomBytes(size).toString('hex');
}

function parseTraceparent(value) {
  if (typeof value !== 'string') return null;
  const parts = value.trim().split('-');
  if (parts.length !== 4) return null;
  const [, traceId, parentSpanId] = parts;
  if (!/^[0-9a-f]{32}$/.test(traceId)) return null;
  if (!/^[0-9a-f]{16}$/.test(parentSpanId)) return null;
  return { traceId, parentSpanId };
}

export class InMemoryTelemetry {
  constructor({ maxSamples = 1000 } = {}) {
    this.maxSamples = maxSamples;
    this.samples = [];
    this.byPath = new Map();
    this.spans = [];
    this.otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || null;
    this.serviceName = process.env.OTEL_SERVICE_NAME || 'smartcart-backend';
  }

  startTrace({ method, path, headers, requestId, userId }) {
    const incoming = parseTraceparent(headers?.traceparent);
    const traceId = incoming?.traceId ?? randomHex(16);
    const spanId = randomHex(8);
    const traceparent = `00-${traceId}-${spanId}-01`;
    return {
      traceId,
      spanId,
      parentSpanId: incoming?.parentSpanId ?? null,
      traceparent,
      requestId,
      method,
      path,
      userId: userId ?? null,
      startedAtNs: process.hrtime.bigint(),
    };
  }

  async endTrace(context, { statusCode }) {
    const durationMs = Number(process.hrtime.bigint() - context.startedAtNs) / 1e6;
    const span = {
      traceId: context.traceId,
      spanId: context.spanId,
      parentSpanId: context.parentSpanId,
      requestId: context.requestId,
      method: context.method,
      path: context.path,
      userId: context.userId,
      statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      ts: new Date().toISOString(),
    };
    this.spans.push(span);
    if (this.spans.length > this.maxSamples) this.spans.shift();
    await this.exportSpan(span);
  }

  async exportSpan(span) {
    if (!this.otlpEndpoint) return;
    const payload = {
      resourceSpans: [{
        resource: {
          attributes: [{ key: 'service.name', value: { stringValue: this.serviceName } }],
        },
        scopeSpans: [{
          scope: { name: 'smartcart.telemetry' },
          spans: [{
            traceId: span.traceId,
            spanId: span.spanId,
            parentSpanId: span.parentSpanId || undefined,
            name: `${span.method} ${span.path}`,
            startTimeUnixNano: String(Date.parse(span.ts) * 1_000_000),
            endTimeUnixNano: String((Date.parse(span.ts) + Math.floor(span.durationMs)) * 1_000_000),
            attributes: [
              { key: 'http.method', value: { stringValue: span.method } },
              { key: 'http.target', value: { stringValue: span.path } },
              { key: 'http.status_code', value: { intValue: String(span.statusCode) } },
              { key: 'smartcart.request_id', value: { stringValue: span.requestId } },
            ],
          }],
        }],
      }],
    };

    try {
      await fetch(this.otlpEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // no-op: telemetry export should not fail requests
    }
  }

  record({ path, status, durationMs, traceId = null }) {
    const sample = {
      path,
      status,
      durationMs: Number(durationMs.toFixed(2)),
      traceId,
      ts: new Date().toISOString(),
    };
    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) this.samples.shift();

    const stats = this.byPath.get(path) ?? { count: 0, errors5xx: 0, errors4xx: 0, durations: [] };
    stats.count += 1;
    if (status >= 500) stats.errors5xx += 1;
    if (status >= 400 && status < 500) stats.errors4xx += 1;
    stats.durations.push(sample.durationMs);
    if (stats.durations.length > this.maxSamples) stats.durations.shift();
    this.byPath.set(path, stats);
  }

  percentile(values, p) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return Number(sorted[idx].toFixed(2));
  }

  snapshot({ queueDepth = null } = {}) {
    const allDurations = this.samples.map((item) => item.durationMs);
    const total = this.samples.length;
    const errors5xx = this.samples.filter((entry) => entry.status >= 500).length;
    const errors4xx = this.samples.filter((entry) => entry.status >= 400 && entry.status < 500).length;

    const endpoints = Array.from(this.byPath.entries()).map(([path, stats]) => ({
      path,
      count: stats.count,
      p95Ms: this.percentile(stats.durations, 95),
      p99Ms: this.percentile(stats.durations, 99),
      error5xxRate: stats.count ? Number((stats.errors5xx / stats.count).toFixed(4)) : 0,
      error4xxRate: stats.count ? Number((stats.errors4xx / stats.count).toFixed(4)) : 0,
    }));

    return {
      sampleSize: total,
      p95Ms: this.percentile(allDurations, 95),
      p99Ms: this.percentile(allDurations, 99),
      error5xxRate: total ? Number((errors5xx / total).toFixed(4)) : 0,
      error4xxRate: total ? Number((errors4xx / total).toFixed(4)) : 0,
      queueDepth,
      endpoints,
      recentSpans: this.spans.slice(-25),
      generatedAt: new Date().toISOString(),
    };
  }
}
