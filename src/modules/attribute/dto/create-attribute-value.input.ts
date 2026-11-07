import { Field, ID, InputType } from '@nestjs/graphql';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

@InputType()
export class CreateAttributeValueInput {
  @Field(() => ID)
  @IsUUID()
  attributeId!: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  value!: string;
}
