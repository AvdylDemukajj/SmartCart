import type { RouteDefinition } from '../core/http/types.js';
import { HealthService } from '../modules/health/health.service.js';
import { HouseholdsService } from '../modules/households/households.service.js';

export function buildRoutes(dependencies: {
  healthService: HealthService;
  householdsService: HouseholdsService;
}): RouteDefinition[] {
  return [
    {
      method: 'GET',
      pathRegex: /^\/health$/,
      handler: (_req, res) => {
        res.json(200, dependencies.healthService.getSnapshot());
      },
    },
    {
      method: 'GET',
      pathRegex: /^\/households$/,
      requiresAuth: true,
      handler: (req, res) => {
        const userId = req.context.userId;
        if (!userId) {
          res.json(401, { error: 'Unauthorized' });
          return;
        }
        const households = dependencies.householdsService.listForUser(userId);
        res.json(200, households);
      },
    },
  ];
}
