import type { DictionaryEntry, PageResult } from '@english-dictionary/application';

import type { AuthenticatedRequest } from './request-context.js';

function pathWithoutQuery(request: AuthenticatedRequest): string {
  return request.originalUrl.split('?')[0] ?? request.originalUrl;
}

function isAuthenticationPath(path: string): boolean {
  return path === '/auth/signup' || path === '/auth/signin';
}

export function summarizeRequest(request: AuthenticatedRequest): Record<string, unknown> {
  const path = pathWithoutQuery(request);

  if (isAuthenticationPath(path)) {
    const body =
      typeof request.body === 'object' && request.body !== null
        ? (request.body as Record<string, unknown>)
        : {};

    return {
      operation: path.endsWith('signup') ? 'signup' : 'signin',
      fields: Object.keys(body).sort(),
    };
  }

  return {
    params: request.params,
    query: request.query,
    body: request.body,
  };
}

export function summarizeResponse(request: AuthenticatedRequest, response: unknown): unknown {
  const path = pathWithoutQuery(request);

  if (isAuthenticationPath(path)) {
    const value =
      typeof response === 'object' && response !== null
        ? (response as Record<string, unknown>)
        : {};

    return {
      id: value.id,
      bearerIssued: typeof value.token === 'string',
    };
  }

  if (request.method === 'GET' && /^\/entries\/en\/[^/]+$/.test(path) && Array.isArray(response)) {
    const entries = response as DictionaryEntry[];
    return {
      word: request.params.word,
      entries: entries.length,
      meanings: entries.reduce((total, entry) => total + entry.meanings.length, 0),
      phonetics: entries.reduce((total, entry) => total + entry.phonetics.length, 0),
      sourceUrls: entries.reduce((total, entry) => total + (entry.sourceUrls?.length ?? 0), 0),
      serializedBytes: Buffer.byteLength(JSON.stringify(entries), 'utf8'),
    };
  }

  if (
    typeof response === 'object' &&
    response !== null &&
    'results' in response &&
    Array.isArray((response as { results: unknown }).results)
  ) {
    const page = response as PageResult<unknown>;
    return {
      page: page.page,
      totalPages: page.totalPages,
      totalDocs: page.totalDocs,
      hasNext: page.hasNext,
      hasPrev: page.hasPrev,
      returned: page.results.length,
      results: page.results,
    };
  }

  return response;
}

export function requestPath(request: AuthenticatedRequest): string {
  return pathWithoutQuery(request);
}
