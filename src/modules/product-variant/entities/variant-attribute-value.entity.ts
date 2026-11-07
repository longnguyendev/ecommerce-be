import { Field, ID, ObjectType } from '@nestjs/graphql';

import { AttributeValue } from '@/modules/attribute/entities/attribute-value.entity';
import { Attribute } from '@/modules/attribute/entities/attribute.entity';

@ObjectType()
export class VariantAttributeValue {
  @Field(() => ID)
  variantId!: string;

  @Field(() => ID)
  attributeId!: string;

  @Field(() => ID)
  attributeValueId!: string;

  @Field(() => Attribute)
  attribute!: Attribute;

  @Field(() => AttributeValue)
  attributeValue!: AttributeValue;
}
