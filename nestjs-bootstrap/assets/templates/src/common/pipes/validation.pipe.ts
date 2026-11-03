import { HttpStatus, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';

export interface FieldError {
  field: string;
  rule: string;
  i18nKey: string;
}

export function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): FieldError[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;

    return [
      ...Object.entries(error.constraints ?? {}).map(([rule, message]) => ({
        field: path,
        rule,
        i18nKey: message,
      })),
      ...flattenValidationErrors(error.children ?? [], path),
    ];
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidUnknownValues: true,
    exceptionFactory: (errors: ValidationError[]) =>
      new AppException(
        'BAD_USER_INPUT',
        I18N_KEYS.ERRORS.SYSTEM.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
        { fields: flattenValidationErrors(errors) },
      ),
  });
}
