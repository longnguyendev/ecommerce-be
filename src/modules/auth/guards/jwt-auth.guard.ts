import {
  CanActivate,
  HttpStatus,
  Injectable,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';

import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';

import type { AuthenticatedRequest, JwtPayload } from '../auth.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

function extractRequest(context: ExecutionContext): AuthenticatedRequest {
  const type = context.getType<'http' | 'graphql'>();
  if (type === 'http') {
    return context.switchToHttp().getRequest<AuthenticatedRequest>();
  }
  const gqlContext = GqlExecutionContext.create(context);
  return gqlContext.getContext<{ req: AuthenticatedRequest }>().req;
}

function extractToken(req: AuthenticatedRequest): string | undefined {
  const header = req.headers?.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' ? token : undefined;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = extractRequest(context);
    const token = extractToken(req);
    if (!token) {
      throw this.unauthorized();
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      req.user = payload;
      return true;
    } catch {
      throw this.unauthorized();
    }
  }

  private unauthorized(): AppException {
    return new AppException(
      'UNAUTHENTICATED',
      I18N_KEYS.ERRORS.SYSTEM.UNAUTHORIZED,
      HttpStatus.UNAUTHORIZED,
    );
  }
}
