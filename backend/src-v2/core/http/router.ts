import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type { RouteDefinition, HttpMethod, HttpRequest, HttpResponse } from './types.js';
import type { AppConfig } from '../../config/env.js';
import { resolveAuthContext } from './auth.js';
import { AppError, ForbiddenError, UnauthorizedError } from './errors.js';

function sendJson(res: ServerResponse, requestId: string, status: number, payload: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json',
    'x-request-id': requestId,
  });
  res.end(JSON.stringify(payload));
}

interface RouterLogEvent {
  requestId: string;
  method: HttpMethod;
  path: string;
  status: number;
  userId: string | null;
  authMethod: string;
  durationMs: number;
  error: string | null;
}

export class HttpRouter {
  constructor(
    private readonly routes: RouteDefinition[],
    private readonly config: AppConfig,
    private readonly logger: (event: RouterLogEvent) => void = (event) => {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(event));
    },
  ) {}

  async dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const requestId = randomUUID();
    const method = (req.method ?? 'GET') as HttpMethod;
    const parsedUrl = new URL(req.url ?? '/', 'http://localhost');
    const pathname = parsedUrl.pathname;
    const startedAt = process.hrtime.bigint();
    let logged = false;

    const matched = this.routes.find((route) => route.method === method && route.pathRegex.test(pathname));
    const auth = resolveAuthContext(req.headers);

    const request: HttpRequest = {
      raw: req,
      method,
      pathname,
      searchParams: parsedUrl.searchParams,
      context: {
        requestId,
        userId: auth.userId,
        authMethod: auth.method,
        startTimeNs: process.hrtime.bigint(),
      },
    };

    const response: HttpResponse = {
      raw: res,
      json: (status, payload) => sendJson(res, requestId, status, payload),
    };

    if (!matched) {
      response.json(404, { error: 'Route not found' });
      this.logRequest({
        requestId,
        method,
        path: pathname,
        status: 404,
        userId: request.context.userId,
        authMethod: request.context.authMethod,
        startedAt,
        error: 'NOT_FOUND',
      });
      return;
    }

    if (
      !this.config.allowInsecureDevAuth &&
      (request.context.authMethod === 'x-user-id' || request.context.authMethod === 'bearer-dev-user')
    ) {
      throw new ForbiddenError('Insecure dev authentication is disabled.');
    }

    if (matched.requiresAuth && !request.context.userId) {
      throw new UnauthorizedError('Missing authentication credentials.');
    }

    res.once('finish', () => {
      if (logged) return;
      logged = true;
      this.logRequest({
        requestId,
        method,
        path: pathname,
        status: res.statusCode,
        userId: request.context.userId,
        authMethod: request.context.authMethod,
        startedAt,
        error: null,
      });
    });

    try {
      await matched.handler(request, response);
    } catch (error) {
      if (logged) return;
      logged = true;
      if (error instanceof AppError) {
        response.json(error.status, { error: error.code, message: error.message });
        this.logRequest({
          requestId,
          method,
          path: pathname,
          status: error.status,
          userId: request.context.userId,
          authMethod: request.context.authMethod,
          startedAt,
          error: error.code,
        });
        return;
      }
      const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
      response.json(500, { error: 'INTERNAL_SERVER_ERROR', message });
      this.logRequest({
        requestId,
        method,
        path: pathname,
        status: 500,
        userId: request.context.userId,
        authMethod: request.context.authMethod,
        startedAt,
        error: message,
      });
      return;
    }
  }

  private logRequest({
    requestId,
    method,
    path,
    status,
    userId,
    authMethod,
    startedAt,
    error,
  }: {
    requestId: string;
    method: HttpMethod;
    path: string;
    status: number;
    userId: string | null;
    authMethod: string;
    startedAt: bigint;
    error: string | null;
  }): void {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    this.logger({
      requestId,
      method,
      path,
      status,
      userId,
      authMethod,
      durationMs: Number(durationMs.toFixed(2)),
      error,
    });
  }
}
