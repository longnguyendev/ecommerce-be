import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import { VariantAttributeValue } from './variant-attribute-value.entity';

@ObjectType()
export class ProductVariant {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  productId!: string;

  @Field()
  sku!: string;

  @Field(() => Int)
  price!: number;

  @Field(() => Int)
  costPrice!: number;

  @Field(() => Int, { nullable: true })
  compareAtPrice?: number | null;

  @Field(() => Int)
  stockQuantity!: number;

  @Field()
  isActive!: boolean;

  @Field(() => [VariantAttributeValue])
  attributes!: VariantAttributeValue[];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null;
}
