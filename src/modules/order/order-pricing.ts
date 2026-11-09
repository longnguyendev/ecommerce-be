import { FREE_SHIPPING_THRESHOLD, SHIPPING_FLAT_FEE } from '@/common/constants';
import type { Prisma } from '@/generated/prisma/client';

export const COLOR_ATTRIBUTE = 'Màu sắc';
export const SIZE_ATTRIBUTE = 'Size';

/** Include dùng chung để lấy đủ dữ liệu snapshot của một biến thể. */
export const variantSnapshotInclude = {
  product: {
    include: {
      images: {
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
      },
    },
  },
  attributes: {
    include: { attribute: true, attributeValue: true },
  },
} satisfies Prisma.ProductVariantInclude;

export type SnapshotVariant = Prisma.ProductVariantGetPayload<{
  include: typeof variantSnapshotInclude;
}>;

/** Phí giao hàng tính theo tạm tính sau giảm giá. */
export function shippingFeeFor(amountAfterDiscount: number): number {
  if (amountAfterDiscount <= 0) {
    return 0;
  }

  return amountAfterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_FEE;
}

export function attributeValue(
  variant: Pick<SnapshotVariant, 'attributes'>,
  attributeName: string,
): string | null {
  return (
    variant.attributes.find((link) => link.attribute.name === attributeName)
      ?.attributeValue.value ?? null
  );
}

/** "Đỏ / L" — null nếu biến thể không có thuộc tính. */
export function variantName(
  variant: Pick<SnapshotVariant, 'attributes'>,
): string | null {
  return variant.attributes.length > 0
    ? variant.attributes.map((link) => link.attributeValue.value).join(' / ')
    : null;
}

/** Ảnh theo màu của biến thể; không có thì ảnh chung đầu tiên, cuối cùng là thumbnail. */
export function variantImage(variant: SnapshotVariant): string | null {
  const colorValueId = variant.attributes.find(
    (link) => link.attribute.name === COLOR_ATTRIBUTE,
  )?.attributeValueId;
  const images = variant.product.images;

  return (
    images.find((i) => colorValueId && i.attributeValueId === colorValueId)
      ?.url ??
    images.find((i) => !i.attributeValueId)?.url ??
    variant.product.thumbnail ??
    null
  );
}

/** Chỉ giữ chữ số, quy +84/84 về 0 để so khớp số điện thoại VN. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  return digits.startsWith('84') && digits.length >= 11
    ? `0${digits.slice(2)}`
    : digits;
}
