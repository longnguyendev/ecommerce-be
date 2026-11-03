import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

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
  const payload = (extensions.originalError ?? {}) as AppErrorPayload;

  if (typeof payload.code === 'string') {
    return {
      message: payload.i18nKey ?? gqlError.message ?? payload.code,
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
