import { Field, ID, InputType } from '@nestjs/graphql';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { PaymentTxStatus } from '@/common/graphql/prisma-enums';

@InputType()
export class UpdatePaymentStatusInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field(() => PaymentTxStatus)
  @IsEnum(PaymentTxStatus)
  status!: PaymentTxStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(190)
  transactionId?: string;
}
