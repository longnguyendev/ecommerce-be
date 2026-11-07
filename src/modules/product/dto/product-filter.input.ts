import { Field, ID, InputType } from '@nestjs/graphql';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { ProductStatus } from '@/common/graphql/prisma-enums';

@InputType()
export class ProductFilterInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @Field(() => ProductStatus, { nullable: true })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  includeDeleted?: boolean;
}
