import type { AppConfig } from '../../config/env.js';

export interface HealthSnapshot {
  ok: true;
  service: string;
  env: string;
  uptimeSeconds: number;
  timestamp: string;
  capabilities: string[];
}

export class HealthService {
  constructor(private readonly config: AppConfig) {}

  getSnapshot(): HealthSnapshot {
    return {
      ok: true,
      service: this.config.appName,
      env: this.config.env,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      capabilities: [
        'typed-modular-architecture',
        'rate-limiting-ready',
        'tenant-isolation-ready',
        'observability-ready',
      ],
    };
  }
}
