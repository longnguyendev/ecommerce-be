import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { GraphQLResolveInfo } from 'graphql';

import { TooManyRequestsException } from '@/common/exceptions/too-many-requests.exception';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  /**
   * Subscription chạy trên WebSocket: không có `res` để ghi header rate-limit,
   * và kết nối đã được xác thực admin ở onConnect -> không throttle.
   */
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (context.getType<string>() === 'graphql') {
      const info =
        GqlExecutionContext.create(context).getInfo<GraphQLResolveInfo>();
      if (info?.operation?.operation === 'subscription') return true;
    }
    return super.shouldSkip(context);
  }

  getRequestResponse(context: ExecutionContext): {
    req: Request;
    res: Response;
  } {
    if (context.getType<string>() === 'http') {
      const http = context.switchToHttp();
      return {
        req: http.getRequest<Request>(),
        res: http.getResponse<Response>(),
      };
    }

    const gqlContext = GqlExecutionContext.create(context).getContext<{
      req: Request;
      res: Response;
    }>();

    return { req: gqlContext.req, res: gqlContext.res };
  }

  protected throwThrottlingException(): Promise<void> {
    throw new TooManyRequestsException();
  }
}
