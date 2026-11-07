import { Field, ID, ObjectType } from '@nestjs/graphql';

import { AttributeValue } from './attribute-value.entity';

@ObjectType()
export class Attribute {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => [AttributeValue], { nullable: true })
  values?: AttributeValue[];
}
