import { Field, ID, InputType } from '@nestjs/graphql';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ProductStatus } from '@/common/graphql/prisma-enums';

@InputType()
export class CreateProductInput {
  @Field(() => ID)
  @IsUUID()
  categoryId!: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(220)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be kebab-case',
  })
  slug!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnail?: string;

  @Field(() => ProductStatus, { nullable: true })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
