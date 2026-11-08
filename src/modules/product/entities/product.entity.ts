import { Field, ID, ObjectType } from '@nestjs/graphql';

import { ProductStatus } from '@/common/graphql/prisma-enums';
import { Category } from '@/modules/category/entities/category.entity';
import { Collection } from '@/modules/collection/entities/collection.entity';
import { ProductImage } from '@/modules/product-image/entities/product-image.entity';
import { ProductVariant } from '@/modules/product-variant/entities/product-variant.entity';

@ObjectType()
export class Product {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  categoryId!: string;

  @Field(() => Category)
  category!: Category;

  @Field()
  name!: string;

  @Field()
  slug!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => String, { nullable: true })
  thumbnail?: string | null;

  @Field(() => ProductStatus)
  status!: ProductStatus;

  @Field(() => [ProductVariant])
  variants!: ProductVariant[];

  @Field(() => [ProductImage])
  images!: ProductImage[];

  @Field(() => [Collection])
  collections!: Collection[];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null;
}
