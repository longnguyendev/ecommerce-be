import { Field, ID, InputType, PartialType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

import { CreateCouponInput } from './create-coupon.input';

@InputType()
export class UpdateCouponInput extends PartialType(CreateCouponInput) {
  @Field(() => ID)
  @IsUUID()
  id!: string;
}
