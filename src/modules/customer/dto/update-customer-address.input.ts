import { Field, ID, InputType, PartialType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

import { CreateCustomerAddressInput } from './create-customer-address.input';

@InputType()
export class UpdateCustomerAddressInput extends PartialType(
  CreateCustomerAddressInput,
) {
  @Field(() => ID)
  @IsUUID()
  id!: string;
}
