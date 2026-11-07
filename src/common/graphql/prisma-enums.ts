import { registerEnumType } from '@nestjs/graphql';

import {
  DiscountType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentTxStatus,
  ProductStatus,
} from '@/generated/prisma/enums';

registerEnumType(ProductStatus, {
  name: 'ProductStatus',
  description: 'Publication state of a product',
});

registerEnumType(DiscountType, {
  name: 'DiscountType',
  description: 'How a coupon discount is calculated',
});

registerEnumType(OrderStatus, {
  name: 'OrderStatus',
  description: 'Lifecycle state of an order',
});

registerEnumType(PaymentStatus, {
  name: 'PaymentStatus',
  description: 'Payment state of an order',
});

registerEnumType(PaymentMethod, {
  name: 'PaymentMethod',
  description: 'How the customer pays for an order',
});

registerEnumType(PaymentTxStatus, {
  name: 'PaymentTxStatus',
  description: 'State of a single payment transaction',
});

export {
  DiscountType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentTxStatus,
  ProductStatus,
};
