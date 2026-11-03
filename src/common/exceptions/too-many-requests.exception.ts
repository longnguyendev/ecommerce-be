import { HttpStatus } from '@nestjs/common';

import { I18N_KEYS } from '@/common/constants';

import { AppException } from './app.exception';

export class TooManyRequestsException extends AppException {
  constructor() {
    super(
      'TOO_MANY_REQUESTS',
      I18N_KEYS.ERRORS.SYSTEM.TOO_MANY_REQUESTS,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
