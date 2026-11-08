import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

@InputType()
export class VariantOptionValueInput {
  @Field(() => ID)
  @IsUUID()
  attributeId!: string;

  /** Giá trị dạng text (L, Hồng...). Chưa có thì BE tự tạo AttributeValue. */
  @Field()
  @IsString()
  @MinLength(1)
  value!: string;
}

@InputType()
export class SyncVariantInput {
  @Field()
  @IsString()
  @MinLength(1)
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

  /** Tổ hợp thuộc tính của biến thể. Rỗng = biến thể mặc định (sản phẩm không có biến thể). */
  @Field(() => [VariantOptionValueInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantOptionValueInput)
  options!: VariantOptionValueInput[];
}

@InputType()
export class SyncProductVariantsInput {
  @Field(() => ID)
  @IsUUID()
  productId!: string;

  @Field(() => [SyncVariantInput])
  @IsArray()
  @ArrayMaxSize(250)
  @ValidateNested({ each: true })
  @Type(() => SyncVariantInput)
  variants!: SyncVariantInput[];
}
