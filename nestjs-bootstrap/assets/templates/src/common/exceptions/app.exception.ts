import { HttpException, HttpStatus } from '@nestjs/common';

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'BAD_USER_INPUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_SERVER_ERROR'
  | 'SERVICE_UNAVAILABLE';

export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    readonly i18nKey: string,
    readonly httpStatus: HttpStatus,
    readonly params?: Record<string, unknown>,
  ) {
    super({ code, i18nKey, params }, httpStatus);
  }
}
