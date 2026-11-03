import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import { AppException } from '../exceptions/app.exception';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    // GraphQL errors are formatted by GqlConfigService.formatError.
    if (host.getType<string>() !== 'http') {
      throw exception;
    }

    const response = host.switchToHttp().getResponse<Response>();
    const isApp = exception instanceof AppException;
    const status = isApp
      ? exception.getStatus()
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `${status} ${exception instanceof Error ? exception.message : String(exception)}`,
      );
    }

    const body = isApp
      ? {
          code: exception.code,
          i18nKey: exception.i18nKey,
          params: exception.params,
        }
      : {
          code: 'INTERNAL_SERVER_ERROR',
          i18nKey: 'errors.system.default',
        };

    response.status(status).json(body);
  }
}
