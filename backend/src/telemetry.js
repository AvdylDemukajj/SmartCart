export class InMemoryTelemetry {
  constructor({ maxSamples = 1000 } = {}) {
    this.maxSamples = maxSamples;
    this.samples = [];
    this.byPath = new Map();
  }

  record({ path, status, durationMs }) {
    const sample = {
      path,
      status,
      durationMs: Number(durationMs.toFixed(2)),
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
      error5xxRate: stats.count ? Number((stats.errors5xx / stats.count).toFixed(4)) : 0,
      error4xxRate: stats.count ? Number((stats.errors4xx / stats.count).toFixed(4)) : 0,
    }));

    return {
      sampleSize: total,
      p95Ms: this.percentile(allDurations, 95),
      error5xxRate: total ? Number((errors5xx / total).toFixed(4)) : 0,
      error4xxRate: total ? Number((errors4xx / total).toFixed(4)) : 0,
      queueDepth,
      endpoints,
      generatedAt: new Date().toISOString(),
    };
  }
}
