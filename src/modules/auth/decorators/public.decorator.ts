import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a handler (or controller/resolver) as publicly accessible — the
 *  JwtAuthGuard skips authentication for it. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
