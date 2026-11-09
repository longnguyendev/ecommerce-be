import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { PubSubEngine } from 'graphql-subscriptions';

import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';
import { PaginationArgs } from '@/common/pagination';
import { PUB_SUB } from '@/core/pubsub/pubsub.module';
import { AdminNotificationType, type Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

import type { MarkAdminNotificationsReadInput } from './dto/mark-read.input';
import type { AdminNotification } from './entities/admin-notification.entity';

export const ADMIN_NOTIFICATION_CREATED = 'admin.notification.created';
/** Thông báo cũ hơn số ngày này bị xoá bởi job dọn dẹp. */
export const NOTIFICATION_TTL_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1_000;

type NotificationRow = Omit<AdminNotification, 'read'>;

export interface NotifiableOrder {
  id: string;
  orderCode: string;
  shippingName: string;
  finalAmount: number;
  items: { quantity: number }[];
}

/** "1050000" -> "1.050.000 ₫" (không phụ thuộc ICU của Node). */
export function formatVnd(amount: number): string {
  return `${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ₫`;
}

export function orderNotificationContent(order: NotifiableOrder) {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    type: AdminNotificationType.ORDER_CREATED,
    title: `Đơn mới ${order.orderCode}`,
    body: `${order.shippingName} · ${itemCount} SP · ${formatVnd(order.finalAmount)}`,
    link: `/admin/orders/${order.id}`,
    orderId: order.id,
  };
}

/** Payload đi qua Redis dạng JSON -> dựng lại Date cho scalar DateTime. */
export function toNotificationEvent(payload: {
  adminNotificationCreated: Omit<AdminNotification, 'createdAt'> & {
    createdAt: Date | string;
  };
}): AdminNotification {
  return {
    ...payload.adminNotificationCreated,
    createdAt: new Date(payload.adminNotificationCreated.createdAt),
  };
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUB_SUB) private readonly pubSub: PubSubEngine,
  ) {}

  /** Gọi TRONG transaction tạo đơn: đơn rollback thì thông báo cũng không có. */
  createForOrderInTx(
    tx: Prisma.TransactionClient,
    order: NotifiableOrder,
  ): Promise<NotificationRow> {
    return tx.adminNotification.create({
      data: orderNotificationContent(order),
    });
  }

  /** Gọi SAU khi commit. Lỗi chỉ log — thông báo vẫn nằm trong DB. */
  async publish(notification: NotificationRow): Promise<void> {
    try {
      await this.pubSub.publish(ADMIN_NOTIFICATION_CREATED, {
        adminNotificationCreated: { ...notification, read: false },
      });
    } catch (error) {
      this.logger.error(
        `Publish ${ADMIN_NOTIFICATION_CREATED} failed for ${notification.id}`,
        error as Error,
      );
    }
  }

  onCreated() {
    return this.pubSub.asyncIterableIterator(ADMIN_NOTIFICATION_CREATED);
  }

  async list(userId: string, pagination: PaginationArgs = {}) {
    const take = Math.min(pagination.take ?? 20, 100);
    const skip = pagination.skip ?? 0;

    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.adminNotification.findMany({
        take: take + 1,
        skip,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { reads: { where: { userId }, select: { userId: true } } },
      }),
      this.prisma.adminNotification.count(),
    ]);

    const hasNextPage = rows.length > take;
    const nodes = (hasNextPage ? rows.slice(0, take) : rows).map(
      ({ reads, ...row }) => ({ ...row, read: reads.length > 0 }),
    );

    return {
      edges: nodes.map((node) => ({ cursor: node.id, node })),
      nodes,
      totalCount,
      hasNextPage,
    };
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.adminNotification.count({
      where: { reads: { none: { userId } } },
    });
  }

  /** Đánh dấu đã đọc cho riêng admin này; trả về số còn chưa đọc. */
  async markRead(
    userId: string,
    input: MarkAdminNotificationsReadInput,
  ): Promise<number> {
    const selectors = [input.ids?.length, input.orderId, input.all].filter(
      Boolean,
    ).length;

    if (selectors !== 1) {
      throw new AppException(
        'BAD_USER_INPUT',
        I18N_KEYS.ERRORS.SYSTEM.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
        { fields: [{ field: 'input', rule: 'exactlyOne' }] },
      );
    }

    const where: Prisma.AdminNotificationWhereInput = {
      reads: { none: { userId } },
      ...(input.ids?.length ? { id: { in: input.ids } } : {}),
      ...(input.orderId ? { orderId: input.orderId } : {}),
    };
    const unread = await this.prisma.adminNotification.findMany({
      where,
      select: { id: true },
    });

    if (unread.length > 0) {
      await this.prisma.adminNotificationRead.createMany({
        data: unread.map(({ id }) => ({ notificationId: id, userId })),
        skipDuplicates: true,
      });
    }

    return this.unreadCount(userId);
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM, {
    name: 'admin-notification-cleanup',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleCleanup(): Promise<void> {
    try {
      const removed = await this.purgeOld();
      if (removed > 0) {
        this.logger.log(
          `Removed ${removed} notification(s) > ${NOTIFICATION_TTL_DAYS} days`,
        );
      }
    } catch (error) {
      this.logger.error('Notification cleanup failed', error as Error);
    }
  }

  async purgeOld(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.adminNotification.deleteMany({
      where: {
        createdAt: {
          lt: new Date(now.getTime() - NOTIFICATION_TTL_DAYS * DAY_MS),
        },
      },
    });
    return count;
  }
}
