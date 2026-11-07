import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ProductImage {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  productId!: string;

  @Field(() => ID, { nullable: true })
  variantId?: string | null;

  @Field()
  url!: string;

  @Field(() => String, { nullable: true })
  alt?: string | null;

  @Field(() => Int)
  sortOrder!: number;

  @Field()
  isPrimary!: boolean;

  @Field(() => Date)
  createdAt!: Date;
}
