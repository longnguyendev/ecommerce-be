import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

import { AdminNotificationType } from '@/generated/prisma/enums';

registerEnumType(AdminNotificationType, {
  name: 'AdminNotificationType',
  description: 'Loại thông báo cho admin',
});

@ObjectType()
export class AdminNotification {
  @Field(() => ID)
  id!: string;

  @Field(() => AdminNotificationType)
  type!: AdminNotificationType;

  @Field()
  title!: string;

  @Field()
  body!: string;

  @Field(() => String, { nullable: true })
  link?: string | null;

  @Field(() => ID, { nullable: true })
  orderId?: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field({ description: 'Admin đang xem đã đọc thông báo này chưa' })
  read!: boolean;
}
