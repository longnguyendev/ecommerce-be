import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import {
  ReceiptStatus,
  StockMovementType,
} from '@/common/graphql/prisma-enums';

@ObjectType()
export class InventoryVariant {
  @Field(() => ID)
  variantId!: string;

  @Field(() => ID)
  productId!: string;

  @Field()
  productName!: string;

  @Field(() => String, { nullable: true })
  variantName?: string | null;

  @Field()
  sku!: string;

  @Field(() => Int)
  stockQuantity!: number;

  @Field(() => Int)
  costPrice!: number;

  @Field(() => Int)
  price!: number;

  @Field()
  isActive!: boolean;
}

@ObjectType()
export class StockMovement {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  variantId!: string;

  @Field()
  sku!: string;

  @Field()
  productName!: string;

  @Field(() => String, { nullable: true })
  variantName?: string | null;

  @Field(() => StockMovementType)
  type!: StockMovementType;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Int)
  balanceAfter!: number;

  @Field(() => Int, { nullable: true })
  unitCost?: number | null;

  @Field(() => String, { nullable: true })
  reason?: string | null;

  @Field(() => ID, { nullable: true })
  receiptId?: string | null;

  @Field(() => ID, { nullable: true })
  orderId?: string | null;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType()
export class PurchaseReceiptItem {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  variantId!: string;

  @Field()
  sku!: string;

  @Field()
  productName!: string;

  @Field(() => String, { nullable: true })
  variantName?: string | null;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Int)
  unitCost!: number;
}

@ObjectType()
export class RevertShortage {
  @Field(() => ID)
  variantId!: string;

  @Field()
  sku!: string;

  @Field()
  productName!: string;

  @Field(() => String, { nullable: true })
  variantName?: string | null;

  @Field(() => Int)
  required!: number;

  @Field(() => Int)
  available!: number;
}

@ObjectType()
export class PurchaseReceipt {
  @Field(() => ID)
  id!: string;

  @Field()
  code!: string;

  @Field(() => String, { nullable: true })
  note?: string | null;

  @Field(() => ReceiptStatus)
  status!: ReceiptStatus;

  @Field(() => Date, { nullable: true })
  confirmedAt?: Date | null;

  @Field(() => [PurchaseReceiptItem])
  items!: PurchaseReceiptItem[];

  @Field(() => Int)
  totalQuantity!: number;

  @Field(() => Int)
  totalCost!: number;

  /** BE quyết định: phiếu đã nhập kho và tồn hiện tại mọi dòng >= số lượng phiếu. */
  @Field()
  canRevert!: boolean;

  /** Các dòng đang thiếu hàng khiến chưa hoàn được (rỗng nếu hoàn được). */
  @Field(() => [RevertShortage])
  revertShortages!: RevertShortage[];

  @Field(() => Date)
  createdAt!: Date;
}
