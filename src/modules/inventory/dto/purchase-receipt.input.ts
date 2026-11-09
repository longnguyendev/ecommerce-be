import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

@InputType()
export class PurchaseReceiptItemInput {
  @Field(() => ID)
  @IsUUID()
  variantId!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity!: number;

  /** Giá nhập / đơn vị (VND). */
  @Field(() => Int)
  @IsInt()
  @Min(0)
  unitCost!: number;
}

@InputType()
export class CreatePurchaseReceiptInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @Field(() => [PurchaseReceiptItemInput])
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PurchaseReceiptItemInput)
  items!: PurchaseReceiptItemInput[];
}

@InputType()
export class UpdatePurchaseReceiptInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @Field(() => [PurchaseReceiptItemInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PurchaseReceiptItemInput)
  items?: PurchaseReceiptItemInput[];
}
