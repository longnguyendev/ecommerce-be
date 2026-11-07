import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import { DiscountType } from '@/common/graphql/prisma-enums';

@ObjectType()
export class Coupon {
  @Field(() => ID)
  id!: string;

  @Field()
  code!: string;

  @Field(() => DiscountType)
  discountType!: DiscountType;

  @Field(() => Int)
  discountValue!: number;

  @Field(() => Int)
  minOrderValue!: number;

  @Field(() => Int, { nullable: true })
  maxDiscountAmount?: number | null;

  @Field(() => Int, { nullable: true })
  usageLimit?: number | null;

  @Field(() => Int)
  usedCount!: number;

  @Field(() => Date, { nullable: true })
  startDate?: Date | null;

  @Field(() => Date, { nullable: true })
  endDate?: Date | null;

  @Field()
  isActive!: boolean;
}
