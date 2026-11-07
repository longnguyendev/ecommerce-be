import { randomInt } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';

import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';
import {
  DiscountType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@/common/graphql/prisma-enums';
import { PaginationArgs } from '@/common/pagination';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

import { CreateOrderInput } from './dto/create-order.input';
import { OrderFilterInput } from './dto/order-filter.input';
import { UpdateOrderStatusInput } from './dto/update-order-status.input';

const orderInclude = {
  items: true,
  payments: true,
  customer: {
    include: {
      addresses: { orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] },
    },
  },
} satisfies Prisma.OrderInclude;

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPING, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPING]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    pagination: PaginationArgs = {},
    filter: OrderFilterInput = {},
  ) {
    const take = Math.min(pagination.take ?? 20, 100);
    const skip = pagination.skip ?? 0;

    const where: Prisma.OrderWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...(filter.contactPhone
        ? { contactPhone: { contains: filter.contactPhone } }
        : {}),
      ...(filter.from || filter.to
        ? {
            createdAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    };

    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        take: take + 1,
        skip,
        orderBy: { createdAt: 'desc' },
        include: orderInclude,
      }),
      this.prisma.order.count({ where }),
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
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });

    if (!order) {
      throw this.notFound();
    }

    return order;
  }

  async findByCode(orderCode: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderCode: orderCode.toUpperCase() },
      include: orderInclude,
    });

    if (!order) {
      throw this.notFound();
    }

    return order;
  }

  async create(input: CreateOrderInput) {
    if (input.items.length === 0) {
      throw new AppException(
        'BAD_USER_INPUT',
        I18N_KEYS.ERRORS.BUSINESS.ORDER.EMPTY_ITEMS,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Merge duplicated variant lines so stock is checked against the total.
    const quantities = new Map<string, number>();
    for (const item of input.items) {
      quantities.set(
        item.variantId,
        (quantities.get(item.variantId) ?? 0) + item.quantity,
      );
    }
    const variantIds = [...quantities.keys()];

    return this.prisma.$transaction(async (tx) => {
      const variants = await tx.productVariant.findMany({
        where: {
          id: { in: variantIds },
          deletedAt: null,
          isActive: true,
          product: { deletedAt: null },
        },
        include: {
          product: true,
          images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
          attributes: {
            include: { attribute: true, attributeValue: true },
          },
        },
      });

      if (variants.length !== variantIds.length) {
        const found = new Set(variants.map((variant) => variant.id));

        throw new AppException(
          'BAD_USER_INPUT',
          I18N_KEYS.ERRORS.BUSINESS.ORDER.VARIANT_NOT_FOUND,
          HttpStatus.BAD_REQUEST,
          { missing: variantIds.filter((id) => !found.has(id)) },
        );
      }

      let totalAmount = 0;
      const items = variants.map((variant) => {
        const quantity = quantities.get(variant.id)!;

        if (variant.stockQuantity < quantity) {
          throw this.insufficientStock(
            variant.id,
            variant.stockQuantity,
            quantity,
          );
        }

        const lineTotal = variant.price * quantity;
        totalAmount += lineTotal;

        return {
          variantId: variant.id,
          productName: variant.product.name,
          variantName:
            variant.attributes.length > 0
              ? variant.attributes
                  .map((link) => link.attributeValue.value)
                  .join(' / ')
              : null,
          sku: variant.sku,
          image: variant.images[0]?.url ?? variant.product.thumbnail,
          quantity,
          unitPrice: variant.price,
          unitCost: variant.costPrice,
          lineTotal,
        };
      });

      if (input.customerId) {
        const customer = await tx.customer.findUnique({
          where: { id: input.customerId },
          select: { id: true },
        });

        if (!customer) {
          throw new AppException(
            'BAD_USER_INPUT',
            I18N_KEYS.ERRORS.SYSTEM.BAD_REQUEST,
            HttpStatus.BAD_REQUEST,
            { field: 'customerId', entity: 'Customer' },
          );
        }
      }

      let couponId: string | null = null;
      let couponCode: string | null = null;
      let discountAmount = 0;

      if (input.couponCode) {
        const coupon = await tx.coupon.findUnique({
          where: { code: input.couponCode.toUpperCase() },
        });

        if (!coupon) {
          throw this.couponError(
            I18N_KEYS.ERRORS.BUSINESS.COUPON.INVALID,
            HttpStatus.BAD_REQUEST,
          );
        }

        const now = new Date();

        if (!coupon.isActive) {
          throw this.couponError(
            I18N_KEYS.ERRORS.BUSINESS.COUPON.INVALID,
            HttpStatus.BAD_REQUEST,
          );
        }

        if (
          (coupon.startDate && coupon.startDate > now) ||
          (coupon.endDate && coupon.endDate < now)
        ) {
          throw this.couponError(
            I18N_KEYS.ERRORS.BUSINESS.COUPON.EXPIRED,
            HttpStatus.BAD_REQUEST,
          );
        }

        if (
          coupon.usageLimit !== null &&
          coupon.usedCount >= coupon.usageLimit
        ) {
          throw this.couponError(
            I18N_KEYS.ERRORS.BUSINESS.COUPON.USAGE_LIMIT,
            HttpStatus.CONFLICT,
          );
        }

        if (totalAmount < coupon.minOrderValue) {
          throw this.couponError(
            I18N_KEYS.ERRORS.BUSINESS.COUPON.MIN_ORDER_VALUE,
            HttpStatus.BAD_REQUEST,
            { minOrderValue: coupon.minOrderValue },
          );
        }

        discountAmount =
          coupon.discountType === DiscountType.PERCENT
            ? Math.floor((totalAmount * coupon.discountValue) / 100)
            : coupon.discountValue;

        if (coupon.maxDiscountAmount !== null) {
          discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
        }

        discountAmount = Math.max(0, Math.min(discountAmount, totalAmount));
        couponId = coupon.id;
        couponCode = coupon.code;
      }

      const shippingFee = input.shippingFee ?? 0;
      const finalAmount = totalAmount - discountAmount + shippingFee;

      for (const item of items) {
        const updated = await tx.productVariant.updateMany({
          where: {
            id: item.variantId,
            stockQuantity: { gte: item.quantity },
            deletedAt: null,
          },
          data: { stockQuantity: { decrement: item.quantity } },
        });

        if (updated.count === 0) {
          throw this.insufficientStock(item.variantId);
        }
      }

      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { usedCount: { increment: 1 } },
        });
      }

      const orderCode = await this.nextOrderCode(tx);

      return tx.order.create({
        data: {
          orderCode,
          customerId: input.customerId ?? null,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          shippingName: input.shippingName,
          shippingPhone: input.shippingPhone,
          shippingAddress: input.shippingAddress,
          shippingWard: input.shippingWard,
          shippingDistrict: input.shippingDistrict,
          shippingProvince: input.shippingProvince,
          note: input.note,
          totalAmount,
          discountAmount,
          shippingFee,
          finalAmount,
          couponId,
          couponCode,
          paymentMethod: input.paymentMethod,
          items: { create: items },
        },
        include: orderInclude,
      });
    });
  }

  async updateStatus(input: UpdateOrderStatusInput) {
    const order = await this.findOne(input.id);

    if (order.status === input.status) {
      return order;
    }

    if (!TRANSITIONS[order.status].includes(input.status)) {
      throw new AppException(
        'BAD_USER_INPUT',
        I18N_KEYS.ERRORS.BUSINESS.ORDER.INVALID_STATUS_TRANSITION,
        HttpStatus.BAD_REQUEST,
        { from: order.status, to: input.status },
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (input.status === OrderStatus.CANCELLED) {
        for (const item of order.items) {
          if (item.variantId) {
            await tx.productVariant.updateMany({
              where: { id: item.variantId, deletedAt: null },
              data: { stockQuantity: { increment: item.quantity } },
            });
          }
        }
      }

      const data: Prisma.OrderUpdateInput = { status: input.status };

      if (
        input.status === OrderStatus.COMPLETED &&
        order.paymentMethod === PaymentMethod.COD &&
        order.paymentStatus === PaymentStatus.UNPAID
      ) {
        data.paymentStatus = PaymentStatus.PAID;
      }

      return tx.order.update({
        where: { id: input.id },
        data,
        include: orderInclude,
      });
    });
  }

  private async nextOrderCode(tx: Prisma.TransactionClient): Promise<string> {
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = `DH${stamp}${randomInt(100000, 1000000)}`;
      const exists = await tx.order.findUnique({
        where: { orderCode: candidate },
        select: { id: true },
      });

      if (!exists) {
        return candidate;
      }
    }

    throw new AppException(
      'INTERNAL_SERVER_ERROR',
      I18N_KEYS.ERRORS.SYSTEM.INTERNAL_SERVER_ERROR,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  private insufficientStock(
    variantId: string,
    available?: number,
    requested?: number,
  ): AppException {
    return new AppException(
      'CONFLICT',
      I18N_KEYS.ERRORS.BUSINESS.ORDER.INSUFFICIENT_STOCK,
      HttpStatus.CONFLICT,
      { variantId, available, requested },
    );
  }

  private couponError(
    i18nKey: string,
    httpStatus: HttpStatus,
    params?: Record<string, unknown>,
  ): AppException {
    return new AppException('BAD_USER_INPUT', i18nKey, httpStatus, params);
  }

  private notFound(): AppException {
    return new AppException(
      'NOT_FOUND',
      I18N_KEYS.ERRORS.BUSINESS.ORDER.ORDER_NOT_FOUND,
      HttpStatus.NOT_FOUND,
    );
  }
}
