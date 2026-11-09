import type { JwtService } from '@nestjs/jwt';

import { UserRole } from '@/generated/prisma/client';
import type { JwtPayload } from '@/modules/auth/auth.types';

/**
 * Close code khi token hết hạn: client kết nối lại bằng token đã refresh.
 * Dùng dải 4000-4399 (ứng dụng tự định nghĩa): client graphql-ws coi 4401 là lỗi
 * chết và KHÔNG kết nối lại, còn 4000 thì có.
 */
export const WS_CLOSE_TOKEN_EXPIRED = 4000;

interface ClosableSocket {
  close(code?: number, reason?: string): void;
  once(event: 'close', listener: () => void): unknown;
}

/** Phần `ctx` của graphql-ws mà xác thực cần dùng. */
export interface WsConnectionContext {
  connectionParams?: Readonly<Record<string, unknown>>;
  extra: { socket: ClosableSocket; user?: JwtPayload };
}

/**
 * `onConnect` của graphql-ws: chỉ nhận admin. Trả `false` để từ chối (graphql-ws
 * đóng socket với 4403 Forbidden). Hẹn đóng socket đúng lúc access token hết hạn
 * để quyền bị thu hồi không kéo dài theo kết nối.
 */
export async function authenticateWsConnection(
  jwt: JwtService,
  ctx: WsConnectionContext,
  now: () => number = Date.now,
): Promise<boolean> {
  const header = ctx.connectionParams?.authorization;
  if (typeof header !== 'string') return false;

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return false;

  let payload: JwtPayload & { exp?: number };
  try {
    payload = await jwt.verifyAsync(token);
  } catch {
    return false;
  }

  if (payload.role !== UserRole.ADMIN) return false;

  ctx.extra.user = payload;

  if (payload.exp) {
    const ttl = payload.exp * 1000 - now();
    const timer = setTimeout(
      () => ctx.extra.socket.close(WS_CLOSE_TOKEN_EXPIRED, 'Token expired'),
      Math.max(0, ttl),
    );
    timer.unref?.();
    ctx.extra.socket.once('close', () => clearTimeout(timer));
  }

  return true;
}

/**
 * Dựng `req` giả cho subscription để JwtAuthGuard / RolesGuard / ViewerService
 * dùng lại y như HTTP (đọc header authorization, req.user).
 */
export function wsRequest(ctx: WsConnectionContext) {
  const authorization = ctx.connectionParams?.authorization;

  return {
    headers: {
      authorization:
        typeof authorization === 'string' ? authorization : undefined,
    },
    user: ctx.extra.user,
  };
}
