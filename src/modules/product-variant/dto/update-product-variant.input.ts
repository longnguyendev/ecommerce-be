import { Field, ID, InputType, PartialType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

import { CreateProductVariantInput } from './create-product-variant.input';

@InputType()
export class UpdateProductVariantInput extends PartialType(
  CreateProductVariantInput,
) {
  @Field(() => ID)
  @IsUUID()
  id!: string;
}
