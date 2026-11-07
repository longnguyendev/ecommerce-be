import { Field, ID, ObjectType } from '@nestjs/graphql';

import { CustomerAddress } from './customer-address.entity';

@ObjectType()
export class Customer {
  @Field(() => ID)
  id!: string;

  @Field()
  fullName!: string;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => String, { nullable: true })
  phone?: string | null;

  @Field(() => [CustomerAddress])
  addresses!: CustomerAddress[];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}
