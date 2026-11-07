import {
  CanActivate,
  HttpStatus,
  Injectable,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';
import type { UserRole } from '@/generated/prisma/client';

import type { AuthenticatedRequest } from '../auth.types';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const type = context.getType<'http' | 'graphql'>();
    const req: AuthenticatedRequest =
      type === 'http'
        ? context.switchToHttp().getRequest<AuthenticatedRequest>()
        : GqlExecutionContext.create(context).getContext<{
            req: AuthenticatedRequest;
          }>().req;

    const user = req.user;
    if (!user || !requiredRoles.includes(user.role)) {
      throw new AppException(
        'FORBIDDEN',
        I18N_KEYS.ERRORS.SYSTEM.FORBIDDEN,
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
