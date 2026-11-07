import { Field, ID, InputType } from '@nestjs/graphql';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

import { OrderStatus } from '@/common/graphql/prisma-enums';

@InputType()
export class OrderFilterInput {
  @Field(() => OrderStatus, { nullable: true })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  from?: Date;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  to?: Date;
}
