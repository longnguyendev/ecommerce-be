import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

import { DiscountType } from '@/common/graphql/prisma-enums';

@InputType()
export class CreateCouponInput {
  @Field()
  @IsString()
  @MaxLength(60)
  @Matches(/^[A-Z0-9_-]+$/, { message: 'code must be uppercase' })
  code!: string;

  @Field(() => DiscountType)
  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  discountValue!: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  minOrderValue?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxDiscountAmount?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  usageLimit?: number;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  startDate?: Date;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  endDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
