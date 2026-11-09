import { Field, ID, InputType, Int } from '@nestjs/graphql';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { CART_MAX_LINE_QUANTITY } from '@/common/constants';

@InputType()
export class AddCartItemInput {
  @Field({
    nullable: true,
    description: 'Bỏ trống để tạo giỏ mới; kết quả trả về token',
  })
  @IsOptional()
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  cartToken?: string;

  @Field(() => ID)
  @IsUUID()
  variantId!: string;

  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @Min(1)
  @Max(CART_MAX_LINE_QUANTITY)
  quantity!: number;
}

@InputType()
export class UpdateCartItemInput {
  @Field()
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  cartToken!: string;

  @Field(() => ID)
  @IsUUID()
  variantId!: string;

  @Field(() => Int, { description: '0 = xoá dòng' })
  @IsInt()
  @Min(0)
  @Max(CART_MAX_LINE_QUANTITY)
  quantity!: number;
}

@InputType()
export class ApplyCartCouponInput {
  @Field()
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  cartToken!: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  code!: string;
}
