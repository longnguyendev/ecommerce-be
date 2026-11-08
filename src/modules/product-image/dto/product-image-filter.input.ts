import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, IsUUID } from 'class-validator';

@InputType()
export class ProductImageFilterInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  attributeValueId?: string;
}
