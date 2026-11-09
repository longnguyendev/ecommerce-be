import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { CART_TTL_DAYS } from '@/common/constants';
import { PrismaService } from '@/prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1_000;
const BATCH_SIZE = 500;

/**
 * Xoá giỏ hàng không thay đổi quá CART_TTL_DAYS ngày (cả giỏ đang dùng lẫn
 * giỏ đã checkout — đơn hàng không phụ thuộc vào giỏ). CartItem xoá theo cascade.
 * Xoá theo lô để không giữ khoá lâu; chạy song song nhiều instance vẫn an toàn.
 */
@Injectable()
export class CartCleanupService {
  private readonly logger = new Logger(CartCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    name: 'cart-cleanup',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleCron(): Promise<void> {
    try {
      const removed = await this.purgeStale();
      if (removed > 0) {
        this.logger.log(
          `Removed ${removed} cart(s) idle > ${CART_TTL_DAYS} days`,
        );
      }
    } catch (error) {
      this.logger.error('Cart cleanup failed', error as Error);
    }
  }

  /** Trả về số giỏ đã xoá. */
  async purgeStale(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - CART_TTL_DAYS * DAY_MS);
    let removed = 0;

    for (;;) {
      const stale = await this.prisma.cart.findMany({
        where: { updatedAt: { lt: cutoff } },
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (stale.length === 0) break;

      const { count } = await this.prisma.cart.deleteMany({
        where: {
          id: { in: stale.map((cart) => cart.id) },
          // Kiểm tra lại: giỏ vừa được cập nhật giữa hai câu lệnh thì giữ lại.
          updatedAt: { lt: cutoff },
        },
      });
      removed += count;
      if (stale.length < BATCH_SIZE) break;
    }

    return removed;
  }
}
