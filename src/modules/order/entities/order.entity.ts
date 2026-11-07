import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@/common/graphql/prisma-enums';
import { Customer } from '@/modules/customer/entities/customer.entity';
import { Payment } from '@/modules/payment/entities/payment.entity';

import { OrderItem } from './order-item.entity';

@ObjectType()
export class Order {
  @Field(() => ID)
  id!: string;

  @Field()
  orderCode!: string;

  @Field(() => ID, { nullable: true })
  customerId?: string | null;

  @Field(() => Customer, { nullable: true })
  customer?: Customer | null;

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
  note?: string | null;

  @Field(() => Int)
  totalAmount!: number;

  @Field(() => Int)
  discountAmount!: number;

  @Field(() => Int)
  shippingFee!: number;

  @Field(() => Int)
  finalAmount!: number;

  @Field(() => ID, { nullable: true })
  couponId?: string | null;

  @Field(() => String, { nullable: true })
  couponCode?: string | null;

  @Field(() => OrderStatus)
  status!: OrderStatus;

  @Field(() => PaymentStatus)
  paymentStatus!: PaymentStatus;

  @Field(() => PaymentMethod)
  paymentMethod!: PaymentMethod;

  @Field(() => [OrderItem])
  items!: OrderItem[];

  @Field(() => [Payment])
  payments!: Payment[];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}
