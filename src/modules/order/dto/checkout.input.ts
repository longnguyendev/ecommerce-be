import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Số di động / cố định VN: 0xxxxxxxxx hoặc +84xxxxxxxxx (cho phép khoảng trắng, dấu chấm). */
const VN_PHONE = /^(?:\+?84|0)(?:[\s.-]?\d){9,10}$/;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();

  return trimmed === '' ? undefined : trimmed;
};

@InputType()
export class CheckoutInput {
  @Field()
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  cartToken!: string;

  @Field({ nullable: true })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string;

  @Field()
  @Transform(trim)
  @Matches(VN_PHONE, { message: 'contactPhone is invalid' })
  contactPhone!: string;

  @Field()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  shippingName!: string;

  @Field()
  @Transform(trim)
  @Matches(VN_PHONE, { message: 'shippingPhone is invalid' })
  shippingPhone!: string;

  @Field()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  shippingAddress!: string;

  @Field({ description: 'Mã tỉnh/thành (2 chữ số) — xem query `provinces`' })
  @Transform(trim)
  @Matches(/^\d{2}$/, { message: 'shippingProvinceCode is invalid' })
  shippingProvinceCode!: string;

  @Field({ description: 'Mã xã/phường (5 chữ số) — xem query `wards`' })
  @Transform(trim)
  @Matches(/^\d{5}$/, { message: 'shippingWardCode is invalid' })
  shippingWardCode!: string;

  @Field({ nullable: true })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
