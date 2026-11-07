import { Field, ID, InputType } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

import { PaymentTxStatus } from '@/common/graphql/prisma-enums';

@InputType()
export class PaymentFilterInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @Field(() => PaymentTxStatus, { nullable: true })
  @IsOptional()
  @IsEnum(PaymentTxStatus)
  status?: PaymentTxStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  provider?: string;
}
