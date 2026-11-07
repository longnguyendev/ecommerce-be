import type { UserRole } from '@/generated/prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest {
  user?: JwtPayload;
  headers: { authorization?: string };
}
