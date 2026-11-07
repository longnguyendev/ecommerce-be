import { HttpStatus, Injectable } from '@nestjs/common';

import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';
import { PaymentStatus, PaymentTxStatus } from '@/common/graphql/prisma-enums';
import { PaginationArgs } from '@/common/pagination';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

import { CreatePaymentInput } from './dto/create-payment.input';
import { PaymentFilterInput } from './dto/payment-filter.input';
import { UpdatePaymentStatusInput } from './dto/update-payment-status.input';

@Injectable()
export class PaymentService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    pagination: PaginationArgs = {},
    filter: PaymentFilterInput = {},
  ) {
    const take = Math.min(pagination.take ?? 20, 100);
    const skip = pagination.skip ?? 0;

    const where: Prisma.PaymentWhereInput = {
      ...(filter.orderId ? { orderId: filter.orderId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.provider
        ? { provider: { contains: filter.provider, mode: 'insensitive' } }
        : {}),
    };

    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        take: take + 1,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    const hasNextPage = rows.length > take;
    const nodes = hasNextPage ? rows.slice(0, take) : rows;

    return {
      edges: nodes.map((node) => ({ cursor: node.id, node })),
      nodes,
      totalCount,
      hasNextPage,
    };
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });

    if (!payment) {
      throw this.notFound('Payment');
    }

    return payment;
  }

  async create(input: CreatePaymentInput) {
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
      select: { id: true },
    });

    if (!order) {
      throw this.notFound('Order');
    }

    const status = input.status ?? PaymentTxStatus.PENDING;
    const paidAt = status === PaymentTxStatus.SUCCESS ? new Date() : null;

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orderId: input.orderId,
          provider: input.provider,
          transactionId: input.transactionId,
          amount: input.amount,
          status,
          paidAt,
        },
      });

      await this.syncOrderPaymentStatus(tx, input.orderId, status);

      return payment;
    });
  }

  async updateStatus(input: UpdatePaymentStatusInput) {
    const payment = await this.findOne(input.id);
    const paidAt =
      input.status === PaymentTxStatus.SUCCESS
        ? (payment.paidAt ?? new Date())
        : payment.paidAt;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: input.id },
        data: {
          status: input.status,
          transactionId: input.transactionId,
          paidAt,
        },
      });

      await this.syncOrderPaymentStatus(tx, payment.orderId, input.status);

      return updated;
    });
  }

  private async syncOrderPaymentStatus(
    tx: Prisma.TransactionClient,
    orderId: string,
    status: PaymentTxStatus,
  ): Promise<void> {
    const mapping: Partial<Record<PaymentTxStatus, PaymentStatus>> = {
      [PaymentTxStatus.SUCCESS]: PaymentStatus.PAID,
      [PaymentTxStatus.FAILED]: PaymentStatus.FAILED,
      [PaymentTxStatus.REFUNDED]: PaymentStatus.REFUNDED,
    };

    const paymentStatus = mapping[status];

    if (!paymentStatus) {
      return;
    }

    await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus },
    });
  }

  private notFound(entity: string): AppException {
    return new AppException(
      'NOT_FOUND',
      I18N_KEYS.ERRORS.SYSTEM.NOT_FOUND,
      HttpStatus.NOT_FOUND,
      { entity },
    );
  }
}
