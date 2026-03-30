import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AuthMethod } from './auth.js';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestContext {
  requestId: string;
  userId: string | null;
  authMethod: AuthMethod;
  startTimeNs: bigint;
}

export interface HttpRequest {
  raw: IncomingMessage;
  method: HttpMethod;
  pathname: string;
  searchParams: URLSearchParams;
  context: RequestContext;
}

export interface HttpResponse {
  raw: ServerResponse;
  json: (status: number, payload: unknown) => void;
}

export type RouteHandler = (req: HttpRequest, res: HttpResponse) => Promise<void> | void;

export interface RouteDefinition {
  method: HttpMethod;
  pathRegex: RegExp;
  handler: RouteHandler;
  requiresAuth?: boolean;
}
