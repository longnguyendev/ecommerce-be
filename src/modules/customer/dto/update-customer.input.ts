import { Field, ID, InputType, PartialType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

import { CreateCustomerInput } from './create-customer.input';

@InputType()
export class UpdateCustomerInput extends PartialType(CreateCustomerInput) {
  @Field(() => ID)
  @IsUUID()
  id!: string;
}
