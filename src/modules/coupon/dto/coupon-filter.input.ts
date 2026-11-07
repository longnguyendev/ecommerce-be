import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

@InputType()
export class CouponFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  code?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  validNow?: boolean;
}
