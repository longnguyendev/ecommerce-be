import { Field, ID, InputType } from '@nestjs/graphql';
import { IsEnum, IsUUID } from 'class-validator';

import { OrderStatus } from '@/common/graphql/prisma-enums';

@InputType()
export class UpdateOrderStatusInput {
  @Field(() => ID)
  @IsUUID()
  id!: string;

  @Field(() => OrderStatus)
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
