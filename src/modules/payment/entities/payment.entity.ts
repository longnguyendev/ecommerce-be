import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import { PaymentTxStatus } from '@/common/graphql/prisma-enums';

@ObjectType()
export class Payment {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  orderId!: string;

  @Field()
  provider!: string;

  @Field(() => String, { nullable: true })
  transactionId?: string | null;

  @Field(() => Int)
  amount!: number;

  @Field(() => PaymentTxStatus)
  status!: PaymentTxStatus;

  @Field(() => Date, { nullable: true })
  paidAt?: Date | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}
