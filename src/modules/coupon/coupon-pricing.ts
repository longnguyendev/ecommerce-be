import { HttpStatus } from '@nestjs/common';

import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';
import { DiscountType } from '@/common/graphql/prisma-enums';
import type { Coupon, Prisma } from '@/generated/prisma/client';

type CouponReader = Pick<Prisma.TransactionClient, 'coupon'>;

export interface CouponEvaluation {
  coupon: Coupon;
  discountAmount: number;
}

function couponError(
  i18nKey: string,
  httpStatus: HttpStatus,
  params?: Record<string, unknown>,
): AppException {
  return new AppException('BAD_USER_INPUT', i18nKey, httpStatus, params);
}

/**
 * Kiểm tra coupon theo tạm tính và trả về số tiền giảm.
 * Ném AppException nếu coupon không dùng được. Không thay đổi `usedCount`.
 */
export async function evaluateCoupon(
  db: CouponReader,
  code: string,
  subtotal: number,
  now: Date = new Date(),
): Promise<CouponEvaluation> {
  const coupon = await db.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
  });

  if (!coupon || !coupon.isActive) {
    throw couponError(
      I18N_KEYS.ERRORS.BUSINESS.COUPON.INVALID,
      HttpStatus.BAD_REQUEST,
    );
  }

  if (
    (coupon.startDate && coupon.startDate > now) ||
    (coupon.endDate && coupon.endDate < now)
  ) {
    throw couponError(
      I18N_KEYS.ERRORS.BUSINESS.COUPON.EXPIRED,
      HttpStatus.BAD_REQUEST,
    );
  }

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw couponError(
      I18N_KEYS.ERRORS.BUSINESS.COUPON.USAGE_LIMIT,
      HttpStatus.CONFLICT,
    );
  }

  if (subtotal < coupon.minOrderValue) {
    throw couponError(
      I18N_KEYS.ERRORS.BUSINESS.COUPON.MIN_ORDER_VALUE,
      HttpStatus.BAD_REQUEST,
      { minOrderValue: coupon.minOrderValue },
    );
  }

  let discountAmount =
    coupon.discountType === DiscountType.PERCENT
      ? Math.floor((subtotal * coupon.discountValue) / 100)
      : coupon.discountValue;

  if (coupon.maxDiscountAmount !== null) {
    discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
  }

  discountAmount = Math.max(0, Math.min(discountAmount, subtotal));

  return { coupon, discountAmount };
}

/**
 * Tăng lượt dùng coupon một cách nguyên tử: chỉ tăng khi còn lượt,
 * tránh hai đơn đồng thời cùng vượt `usageLimit`.
 */
export async function consumeCoupon(
  tx: Prisma.TransactionClient,
  coupon: Coupon,
): Promise<void> {
  if (coupon.usageLimit === null) {
    await tx.coupon.update({
      where: { id: coupon.id },
      data: { usedCount: { increment: 1 } },
    });

    return;
  }

  const { count } = await tx.coupon.updateMany({
    where: { id: coupon.id, usedCount: { lt: coupon.usageLimit } },
    data: { usedCount: { increment: 1 } },
  });

  if (count === 0) {
    throw couponError(
      I18N_KEYS.ERRORS.BUSINESS.COUPON.USAGE_LIMIT,
      HttpStatus.CONFLICT,
    );
  }
}

/** Trả lại lượt dùng khi đơn bị huỷ. */
export async function releaseCoupon(
  tx: Prisma.TransactionClient,
  couponId: string,
): Promise<void> {
  await tx.coupon.updateMany({
    where: { id: couponId, usedCount: { gt: 0 } },
    data: { usedCount: { decrement: 1 } },
  });
}
