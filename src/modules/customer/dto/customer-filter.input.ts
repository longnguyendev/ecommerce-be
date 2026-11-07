import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

@InputType()
export class CustomerFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;
}
