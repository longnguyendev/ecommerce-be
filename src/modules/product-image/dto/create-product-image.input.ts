import { Field, ID, InputType, Int } from '@nestjs/graphql';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

@InputType()
export class CreateProductImageInput {
  @Field(() => ID)
  @IsUUID()
  productId!: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @Field()
  @IsString()
  @MaxLength(1000)
  url!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  alt?: string;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
