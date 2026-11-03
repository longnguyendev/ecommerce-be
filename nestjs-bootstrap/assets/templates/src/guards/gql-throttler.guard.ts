import { TooManyRequestsException } from '@/common/exceptions/too-many-requests.exception';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
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
