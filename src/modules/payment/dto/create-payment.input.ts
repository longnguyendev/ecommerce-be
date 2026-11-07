import { Field, ID, InputType, Int } from '@nestjs/graphql';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

import { PaymentTxStatus } from '@/common/graphql/prisma-enums';

@InputType()
export class CreatePaymentInput {
  @Field(() => ID)
  @IsUUID()
  orderId!: string;

  @Field()
  @IsString()
  @MaxLength(60)
  provider!: string;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  amount!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(190)
  transactionId?: string;

  @Field(() => PaymentTxStatus, { nullable: true })
  @IsOptional()
  @IsEnum(PaymentTxStatus)
  status?: PaymentTxStatus;
}
