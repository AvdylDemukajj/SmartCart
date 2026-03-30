import http from 'node:http';
import { loadConfig } from './config/env.js';
import { HttpRouter } from './core/http/router.js';
import { buildRoutes } from './application/routes.js';
import { HealthService } from './modules/health/health.service.js';
import { HouseholdsService } from './modules/households/households.service.js';

const config = loadConfig();

const healthService = new HealthService(config);
const householdsService = new HouseholdsService();

const router = new HttpRouter(
  buildRoutes({
    healthService,
    householdsService,
  }),
  config,
);

const server = http.createServer((req, res) => {
  void router.dispatch(req, res);
});

server.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[${config.appName}] listening on http://localhost:${config.port}`);
});
