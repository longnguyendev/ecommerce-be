import { Field, ID, InputType } from '@nestjs/graphql';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

@InputType()
export class CreateCustomerAddressInput {
  @Field(() => ID)
  @IsUUID()
  customerId!: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  fullName!: string;

  @Field()
  @IsString()
  @Matches(/^[0-9+\-\s().]{6,20}$/, { message: 'phone is invalid' })
  phone!: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  address!: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  ward!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  district?: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  province!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
