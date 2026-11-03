import { Module } from '@nestjs/common';

import { GraphqlConfigModule } from './gql/graphql.module';
import { JwtConfigModule } from './jwt/jwt.module';
import { RedisConfigModule } from './redis/redis-config.module';

@Module({
  imports: [GraphqlConfigModule, JwtConfigModule, RedisConfigModule],
  exports: [GraphqlConfigModule, JwtConfigModule, RedisConfigModule],
})
export class CoreModule {}
