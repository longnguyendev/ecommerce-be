import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { catchError, Observable, throwError } from 'rxjs';

import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';
import { Prisma } from '@/generated/prisma/client';

@Injectable()
export class PrismaErrorInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
          return throwError(() => error);
        }

        switch (error.code) {
          case 'P2002':
          case 'P2003':
            return throwError(
              () =>
                new AppException(
                  'CONFLICT',
                  I18N_KEYS.ERRORS.SYSTEM.CONFLICT,
                  HttpStatus.CONFLICT,
                  { fields: error.meta?.target },
                ),
            );
          case 'P2025':
            return throwError(
              () =>
                new AppException(
                  'NOT_FOUND',
                  I18N_KEYS.ERRORS.SYSTEM.NOT_FOUND,
                  HttpStatus.NOT_FOUND,
                ),
            );
          case 'P1001':
          case 'P1002':
            return throwError(
              () =>
                new AppException(
                  'SERVICE_UNAVAILABLE',
                  I18N_KEYS.ERRORS.SYSTEM.SERVICE_UNAVAILABLE,
                  HttpStatus.SERVICE_UNAVAILABLE,
                ),
            );
          default:
            return throwError(() => error);
        }
      }),
    );
  }
}
