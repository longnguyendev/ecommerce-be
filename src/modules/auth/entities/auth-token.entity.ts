import { Field, ObjectType } from '@nestjs/graphql';

import { User } from './user.entity';

@ObjectType()
export class AuthToken {
  @Field()
  accessToken!: string;

  @Field()
  refreshToken!: string;

  @Field(() => User)
  user!: User;
}
