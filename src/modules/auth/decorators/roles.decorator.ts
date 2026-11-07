import { SetMetadata } from '@nestjs/common';

import type { UserRole } from '@/generated/prisma/client';

export const ROLES_KEY = 'roles';

/** Restricts a handler to the given roles (checked by RolesGuard). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
