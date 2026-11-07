import { Field, ID, InputType, Int } from '@nestjs/graphql';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

@InputType()
export class CreateProductVariantInput {
  @Field(() => ID)
  @IsUUID()
  productId!: string;

  @Field()
  @IsString()
  sku!: string;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  price!: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  costPrice?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  compareAtPrice?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field(() => [ID], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  attributeValueIds?: string[];
}
