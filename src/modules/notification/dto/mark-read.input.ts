import { Field, ID, InputType } from '@nestjs/graphql';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';

/** Chọn đúng một trong: ids / orderId / all. */
@InputType()
export class MarkAdminNotificationsReadInput {
  @Field(() => [ID], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  ids?: string[];

  @Field(() => ID, {
    nullable: true,
    description: 'Đánh dấu đã đọc mọi thông báo của đơn này',
  })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @Field({ nullable: true, description: 'Đánh dấu đã đọc tất cả' })
  @IsOptional()
  @IsBoolean()
  all?: boolean;
}
