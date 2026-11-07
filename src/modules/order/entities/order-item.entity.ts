import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class OrderItem {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  orderId!: string;

  @Field(() => ID, { nullable: true })
  variantId?: string | null;

  @Field()
  productName!: string;

  @Field(() => String, { nullable: true })
  variantName?: string | null;

  @Field()
  sku!: string;

  @Field(() => String, { nullable: true })
  image?: string | null;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Int)
  unitPrice!: number;

  @Field(() => Int)
  unitCost!: number;

  @Field(() => Int)
  lineTotal!: number;
}
