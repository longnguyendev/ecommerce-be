import type { PubSubEngine } from 'graphql-subscriptions';

import { AdminNotificationType } from '@/generated/prisma/enums';
import type { PrismaService } from '@/prisma/prisma.service';

import {
  ADMIN_NOTIFICATION_CREATED,
  formatVnd,
  NotificationService,
  orderNotificationContent,
  toNotificationEvent,
} from './notification.service';

describe('NotificationService (unit)', () => {
  const order = {
    id: 'o1',
    orderCode: 'DH20261110123456',
    shippingName: 'Nguyễn Văn A',
    finalAmount: 1_050_000,
    items: [{ quantity: 2 }, { quantity: 1 }],
  };

  it('formatVnd', () => {
    expect(formatVnd(0)).toBe('0 ₫');
    expect(formatVnd(30_000)).toBe('30.000 ₫');
    expect(formatVnd(1_050_000)).toBe('1.050.000 ₫');
  });

  it('nội dung thông báo đơn mới: tiêu đề, tóm tắt, link', () => {
    expect(orderNotificationContent(order)).toEqual({
      type: AdminNotificationType.ORDER_CREATED,
      title: 'Đơn mới DH20261110123456',
      body: 'Nguyễn Văn A · 3 SP · 1.050.000 ₫',
      link: '/admin/orders/o1',
      orderId: 'o1',
    });
  });

  const row = {
    id: 'n1',
    createdAt: new Date('2026-11-10T03:00:00Z'),
    ...orderNotificationContent(order),
  };

  it('publish đẩy thông báo với read=false', async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    const service = new NotificationService(
      {} as PrismaService,
      { publish } as unknown as PubSubEngine,
    );

    await service.publish(row);

    expect(publish).toHaveBeenCalledWith(ADMIN_NOTIFICATION_CREATED, {
      adminNotificationCreated: { ...row, read: false },
    });
  });

  it('publish lỗi (Redis down) chỉ log, không ném', async () => {
    const service = new NotificationService(
      {} as PrismaService,
      {
        publish: jest.fn().mockRejectedValue(new Error('redis down')),
      } as unknown as PubSubEngine,
    );
    jest
      .spyOn(
        (service as unknown as { logger: { error: () => void } }).logger,
        'error',
      )
      .mockImplementation(() => undefined);

    await expect(service.publish(row)).resolves.toBeUndefined();
  });

  it('toNotificationEvent dựng lại Date sau khi đi qua JSON (Redis)', () => {
    const wire = JSON.parse(
      JSON.stringify({ adminNotificationCreated: { ...row, read: false } }),
    ) as Parameters<typeof toNotificationEvent>[0];

    const event = toNotificationEvent(wire);

    expect(event.createdAt).toBeInstanceOf(Date);
    expect(event.createdAt.toISOString()).toBe(row.createdAt.toISOString());
  });
});
