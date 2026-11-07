import { HttpStatus, Injectable } from '@nestjs/common';

import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';
import { DiscountType } from '@/common/graphql/prisma-enums';
import { PaginationArgs } from '@/common/pagination';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

import { CouponFilterInput } from './dto/coupon-filter.input';
import { CreateCouponInput } from './dto/create-coupon.input';
import { UpdateCouponInput } from './dto/update-coupon.input';

@Injectable()
export class CouponService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    pagination: PaginationArgs = {},
    filter: CouponFilterInput = {},
  ) {
    const take = Math.min(pagination.take ?? 20, 100);
    const skip = pagination.skip ?? 0;
    const now = new Date();

    const where: Prisma.CouponWhereInput = {
      ...(filter.code
        ? { code: { contains: filter.code, mode: 'insensitive' } }
        : {}),
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
    };

    if (filter.validNow) {
      where.isActive = true;
      where.AND = [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ];
    }

    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.coupon.findMany({
        where,
        take: take + 1,
        skip,
        orderBy: { code: 'asc' },
      }),
      this.prisma.coupon.count({ where }),
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
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });

    if (!coupon) {
      throw this.notFound();
    }

    return coupon;
  }

  async findByCode(code: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!coupon) {
      throw this.notFound();
    }

    return coupon;
  }

  async create(input: CreateCouponInput) {
    this.assertDiscount(input.discountType, input.discountValue);

    return this.prisma.coupon.create({
      data: {
        code: input.code.toUpperCase(),
        discountType: input.discountType,
        discountValue: input.discountValue,
        minOrderValue: input.minOrderValue ?? 0,
        maxDiscountAmount: input.maxDiscountAmount,
        usageLimit: input.usageLimit,
        startDate: input.startDate,
        endDate: input.endDate,
        isActive: input.isActive ?? true,
      },
    });
  }

  async update(input: UpdateCouponInput) {
    const { id, ...changes } = input;
    const existing = await this.findOne(id);

    const discountType = changes.discountType ?? existing.discountType;
    const discountValue = changes.discountValue ?? existing.discountValue;
    this.assertDiscount(discountType, discountValue);
    this.assertDateRange(
      changes.startDate !== undefined ? changes.startDate : existing.startDate,
      changes.endDate !== undefined ? changes.endDate : existing.endDate,
    );

    return this.prisma.coupon.update({
      where: { id },
      data: {
        code: changes.code?.toUpperCase(),
        discountType: changes.discountType,
        discountValue: changes.discountValue,
        minOrderValue: changes.minOrderValue,
        maxDiscountAmount: changes.maxDiscountAmount,
        usageLimit: changes.usageLimit,
        startDate: changes.startDate,
        endDate: changes.endDate,
        isActive: changes.isActive,
      },
    });
  }

  async remove(id: string): Promise<boolean> {
    await this.findOne(id);
    await this.prisma.coupon.delete({ where: { id } });

    return true;
  }

  private assertDiscount(
    discountType: DiscountType,
    discountValue: number,
  ): void {
    if (discountType === DiscountType.PERCENT && discountValue > 100) {
      throw new AppException(
        'BAD_USER_INPUT',
        I18N_KEYS.ERRORS.SYSTEM.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
        { field: 'discountValue', reason: 'percent must be <= 100' },
      );
    }
  }

  private assertDateRange(
    startDate: Date | null | undefined,
    endDate: Date | null | undefined,
  ): void {
    if (startDate && endDate && startDate > endDate) {
      throw new AppException(
        'BAD_USER_INPUT',
        I18N_KEYS.ERRORS.SYSTEM.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
        { field: 'endDate', reason: 'endDate must be after startDate' },
      );
    }
  }

  private notFound(): AppException {
    return new AppException(
      'NOT_FOUND',
      I18N_KEYS.ERRORS.SYSTEM.NOT_FOUND,
      HttpStatus.NOT_FOUND,
      { entity: 'Coupon' },
    );
  }
}
