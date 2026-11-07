import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import type { JwtPayload } from '../auth.types';

/** Injects the authenticated user (JWT payload) from the GraphQL context. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload | undefined => {
    const gqlContext = GqlExecutionContext.create(context);
    return gqlContext.getContext().req?.user;
  },
);
