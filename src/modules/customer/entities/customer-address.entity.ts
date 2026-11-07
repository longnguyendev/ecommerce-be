import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CustomerAddress {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  customerId!: string;

  @Field()
  fullName!: string;

  @Field()
  phone!: string;

  @Field()
  address!: string;

  @Field()
  ward!: string;

  @Field(() => String, { nullable: true })
  district?: string | null;

  @Field()
  province!: string;

  @Field()
  isDefault!: boolean;
}
