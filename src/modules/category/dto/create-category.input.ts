import { Field, ID, InputType } from '@nestjs/graphql';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

@InputType()
export class CreateCategoryInput {
  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(140)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be kebab-case',
  })
  slug!: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
