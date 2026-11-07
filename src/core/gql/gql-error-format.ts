import { randomUUID } from 'node:crypto';

import { HttpException, Logger } from '@nestjs/common';
import type { GraphQLFormattedError } from 'graphql';

interface ApolloErrorLike {
  message?: string;
  path?: readonly (string | number)[];
  extensions?: Record<string, unknown>;
  originalError?: Error;
}

interface AppErrorPayload {
  code?: string;
  i18nKey?: string;
  params?: Record<string, unknown>;
}

/**
 * Resolves the structured payload of an AppException. Apollo may pass the
 * original error directly or wrap it in a GraphQLError, while Nest stores the
 * HTTP response under `extensions.originalError` — support every shape.
 */
function resolveAppPayload(
  error: unknown,
  extensions: Record<string, unknown>,
): AppErrorPayload | null {
  const gqlError = (error ?? {}) as ApolloErrorLike;
  const candidates: unknown[] = [
    extensions.originalError,
    gqlError.originalError,
    error,
  ];

  for (const candidate of candidates) {
    if (candidate instanceof HttpException) {
      const response = candidate.getResponse();

      if (response && typeof response === 'object') {
        const payload = response as AppErrorPayload;

        if (typeof payload.code === 'string') {
          return payload;
        }
      }
    }

    if (candidate && typeof candidate === 'object') {
      const payload = candidate as AppErrorPayload;

      if (typeof payload.code === 'string') {
        return payload;
      }
    }
  }

  return null;
}

const CLIENT_CODES = new Set([
  'GRAPHQL_VALIDATION_FAILED',
  'GRAPHQL_PARSE_FAILED',
  'BAD_USER_INPUT',
]);

const logger = new Logger('GraphQL');

export function formatGraphQLError(
  formatted: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  const gqlError = (error ?? {}) as ApolloErrorLike;
  const extensions = gqlError.extensions ?? {};
  const payload = resolveAppPayload(error, extensions);

  if (payload) {
    return {
      message: payload.i18nKey ?? gqlError.message ?? payload.code ?? 'ERROR',
      path: formatted.path,
      locations: formatted.locations,
      extensions: {
        code: payload.code,
        i18nKey: payload.i18nKey,
        params: payload.params,
      },
    };
  }

  const apolloCode = extensions.code;
  if (typeof apolloCode === 'string' && CLIENT_CODES.has(apolloCode)) {
    return {
      message: gqlError.message ?? 'BAD_USER_INPUT',
      path: formatted.path,
      locations: formatted.locations,
      extensions: { code: apolloCode },
    };
  }

  const errorId = randomUUID();
  logger.error({
    errorId,
    path: gqlError.path,
    message: gqlError.message,
    stack: gqlError.originalError?.stack ?? (error as Error | undefined)?.stack,
  });

  return {
    message: 'INTERNAL_SERVER_ERROR',
    path: formatted.path,
    locations: formatted.locations,
    extensions: { code: 'INTERNAL_SERVER_ERROR', errorId },
  };
}
