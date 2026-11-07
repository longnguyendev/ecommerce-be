import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

import { UserRole } from '@/generated/prisma/client';

registerEnumType(UserRole, { name: 'UserRole' });

@ObjectType()
export class User {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field({ nullable: true })
  displayName?: string;

  @Field(() => UserRole)
  role!: UserRole;

  @Field()
  isActive!: boolean;
}
