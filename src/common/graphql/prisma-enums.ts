import { registerEnumType } from '@nestjs/graphql';

import {
  DiscountType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentTxStatus,
  ProductStatus,
  ReceiptStatus,
  StockMovementType,
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

registerEnumType(StockMovementType, {
  name: 'StockMovementType',
  description: 'Why the stock of a variant changed',
});

registerEnumType(ReceiptStatus, {
  name: 'ReceiptStatus',
  description: 'Lifecycle state of a purchase receipt',
});

export {
  DiscountType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentTxStatus,
  ProductStatus,
  ReceiptStatus,
  StockMovementType,
};
