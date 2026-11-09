import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { UserRole } from '@/generated/prisma/client';

import type { AuthenticatedRequest, JwtPayload } from './auth.types';

/**
 * Xác định người gọi trên các API công khai (không có JwtAuthGuard) để ẩn/hiện
 * dữ liệu nội bộ theo quyền. Token sai/hết hạn = khách, không ném lỗi.
 * Kết quả cache theo request vì field resolver chạy cho từng dòng.
 */
@Injectable()
export class ViewerService {
  private readonly cache = new WeakMap<object, Promise<JwtPayload | null>>();

  constructor(private readonly jwtService: JwtService) {}

  viewer(req: AuthenticatedRequest | undefined): Promise<JwtPayload | null> {
    if (!req) return Promise.resolve(null);
    if (req.user) return Promise.resolve(req.user);

    let pending = this.cache.get(req);
    if (!pending) {
      pending = this.verify(req);
      this.cache.set(req, pending);
    }
    return pending;
  }

  async isAdmin(req: AuthenticatedRequest | undefined): Promise<boolean> {
    return (await this.viewer(req))?.role === UserRole.ADMIN;
  }

  private async verify(req: AuthenticatedRequest): Promise<JwtPayload | null> {
    const [scheme, token] = req.headers?.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) return null;

    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      return null;
    }
  }
}
