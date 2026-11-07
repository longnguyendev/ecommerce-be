import { Field, ID, InputType, PartialType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

import { CreateProductInput } from './create-product.input';

@InputType()
export class UpdateProductInput extends PartialType(CreateProductInput) {
  @Field(() => ID)
  @IsUUID()
  id!: string;
}
