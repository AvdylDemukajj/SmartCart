import { pricingStagingSchema } from '../validation.js';
import { parseValidatedBody, replyJson } from './route-kit.js';

export async function handleGlobalRoutes({ method, url, req, res, userId, requestId, store, logRequest, sendJson, readBody }) {
  if (method === 'GET' && url.pathname === '/recipes/cache') {
    const payload = store.getRecipeCacheStatus();
    return replyJson({ sendJson, logRequest, res, requestId, method, path: url.pathname, userId, status: 200, payload });
  }

  if (method === 'GET' && url.pathname === '/pricing/cache') {
    const payload = store.getPricingCacheStatus();
    return replyJson({ sendJson, logRequest, res, requestId, method, path: url.pathname, userId, status: 200, payload });
  }

  if (method === 'GET' && url.pathname === '/pricing/pipeline') {
    const payload = store.getPricingPipelineStatus();
    return replyJson({ sendJson, logRequest, res, requestId, method, path: url.pathname, userId, status: 200, payload });
  }

  if (method === 'POST' && url.pathname === '/pricing/staging') {
    const body = await parseValidatedBody({ req, readBody, schema: pricingStagingSchema });
    const payload = store.ingestStagingPrices({ actorId: userId, rows: body.rows, traceContext: { requestId } });
    return replyJson({
      sendJson,
      logRequest,
      res,
      requestId,
      method,
      path: url.pathname,
      userId,
      status: 201,
      payload: { ingested: payload.length },
    });
  }

  if (method === 'POST' && url.pathname === '/pricing/promote') {
    const payload = store.promoteStagingPrices({ actorId: userId, traceContext: { requestId } });
    return replyJson({ sendJson, logRequest, res, requestId, method, path: url.pathname, userId, status: 200, payload });
  }

  return false;
}
