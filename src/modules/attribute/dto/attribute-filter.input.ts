import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

@InputType()
export class AttributeFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;
}
