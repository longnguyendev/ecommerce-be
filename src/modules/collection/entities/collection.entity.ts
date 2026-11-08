import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Collection {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  slug!: string;

  @Field(() => String, { nullable: true })
  image?: string | null;

  @Field(() => Int)
  sortOrder!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}
