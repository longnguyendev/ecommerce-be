import { Field, ID, InputType, Int } from '@nestjs/graphql';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

import {
  ReceiptStatus,
  StockMovementType,
} from '@/common/graphql/prisma-enums';

@InputType()
export class AdjustStockInput {
  @Field(() => ID)
  @IsUUID()
  variantId!: string;

  /** Số tồn thực tế sau kiểm kho. */
  @Field(() => Int)
  @IsInt()
  @Min(0)
  newQuantity!: number;

  /** Bắt buộc: lý do điều chỉnh (kiểm kho, hỏng, mất...). */
  @Field()
  @IsString()
  @MinLength(1)
  reason!: string;
}

@InputType()
export class InventoryFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  /** Chỉ lấy biến thể có tồn <= ngưỡng này. */
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;
}

@InputType()
export class StockMovementFilterInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @Field(() => StockMovementType, { nullable: true })
  @IsOptional()
  @IsEnum(StockMovementType)
  type?: StockMovementType;
}

@InputType()
export class PurchaseReceiptFilterInput {
  @Field(() => ReceiptStatus, { nullable: true })
  @IsOptional()
  @IsEnum(ReceiptStatus)
  status?: ReceiptStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;
}
