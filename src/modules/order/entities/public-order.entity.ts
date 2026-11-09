import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@/common/graphql/prisma-enums';

/** Dòng đơn hàng hiển thị cho khách — không có giá vốn. */
@ObjectType()
export class PublicOrderItem {
  @Field(() => ID)
  id!: string;

  @Field()
  productName!: string;

  @Field(() => String, { nullable: true })
  variantName?: string | null;

  @Field()
  sku!: string;

  @Field(() => String, { nullable: true })
  image?: string | null;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Int)
  unitPrice!: number;

  @Field(() => Int)
  lineTotal!: number;
}

/** Đơn hàng hiển thị cho khách (checkout / tra cứu) — không có dữ liệu nội bộ. */
@ObjectType()
export class PublicOrder {
  @Field(() => ID)
  id!: string;

  @Field()
  orderCode!: string;

  @Field(() => String, { nullable: true })
  contactEmail?: string | null;

  @Field()
  contactPhone!: string;

  @Field()
  shippingName!: string;

  @Field()
  shippingPhone!: string;

  @Field()
  shippingAddress!: string;

  @Field()
  shippingWard!: string;

  @Field(() => String, { nullable: true })
  shippingDistrict?: string | null;

  @Field()
  shippingProvince!: string;

  @Field(() => String, { nullable: true })
  shippingProvinceCode?: string | null;

  @Field(() => String, { nullable: true })
  shippingWardCode?: string | null;

  @Field(() => String, { nullable: true })
  note?: string | null;

  @Field(() => Int)
  totalAmount!: number;

  @Field(() => Int)
  discountAmount!: number;

  @Field(() => Int)
  shippingFee!: number;

  @Field(() => Int)
  finalAmount!: number;

  @Field(() => String, { nullable: true })
  couponCode?: string | null;

  @Field(() => OrderStatus)
  status!: OrderStatus;

  @Field(() => PaymentStatus)
  paymentStatus!: PaymentStatus;

  @Field(() => PaymentMethod)
  paymentMethod!: PaymentMethod;

  @Field(() => [PublicOrderItem])
  items!: PublicOrderItem[];

  @Field(() => Date)
  createdAt!: Date;
}
