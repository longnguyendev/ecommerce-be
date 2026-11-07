import { Field, InputType } from '@nestjs/graphql';
import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

@InputType()
export class CreateAttributeInput {
  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(120, { each: true })
  values?: string[];
}
