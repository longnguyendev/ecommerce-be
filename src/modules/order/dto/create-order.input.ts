import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { PaymentMethod } from '@/common/graphql/prisma-enums';

@InputType()
export class OrderItemInput {
  @Field(() => ID)
  @IsUUID()
  variantId!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  quantity!: number;
}

@InputType()
export class CreateOrderInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string;

  @Field()
  @IsString()
  @Matches(/^[0-9+\-\s().]{6,20}$/, { message: 'contactPhone is invalid' })
  contactPhone!: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  shippingName!: string;

  @Field()
  @IsString()
  @Matches(/^[0-9+\-\s().]{6,20}$/, { message: 'shippingPhone is invalid' })
  shippingPhone!: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  shippingAddress!: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  shippingWard!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  shippingDistrict?: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  shippingProvince!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @Field(() => [OrderItemInput])
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInput)
  items!: OrderItemInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  couponCode?: string;

  @Field(() => PaymentMethod)
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @Field(() => Int, {
    nullable: true,
    description: 'Bỏ trống để tính theo quy tắc phí ship chung',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  shippingFee?: number;
}
