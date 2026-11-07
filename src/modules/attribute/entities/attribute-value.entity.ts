import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AttributeValue {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  attributeId!: string;

  @Field()
  value!: string;
}
