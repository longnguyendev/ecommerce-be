import { Field, ID, InputType } from '@nestjs/graphql';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

@InputType()
export class UpdateAttributeValueInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  value!: string;
}
