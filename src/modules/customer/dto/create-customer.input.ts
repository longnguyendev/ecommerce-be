import { Field, InputType } from '@nestjs/graphql';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

@InputType()
export class CreateCustomerInput {
  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  fullName!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s().]{6,20}$/, { message: 'phone is invalid' })
  phone?: string;
}
