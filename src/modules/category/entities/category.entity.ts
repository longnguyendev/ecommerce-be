import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Category {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  slug!: string;

  @Field(() => ID, { nullable: true })
  parentId?: string | null;

  @Field(() => Category, { nullable: true })
  parent?: Category | null;

  @Field(() => [Category], { nullable: true })
  children?: Category[];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}
