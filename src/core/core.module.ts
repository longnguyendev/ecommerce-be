import { Module } from '@nestjs/common';

import { GraphqlConfigModule } from './gql/graphql.module';
import { JwtConfigModule } from './jwt/jwt.module';
import { PubSubModule } from './pubsub/pubsub.module';
import { RedisConfigModule } from './redis/redis-config.module';

@Module({
  imports: [
    GraphqlConfigModule,
    JwtConfigModule,
    RedisConfigModule,
    PubSubModule,
  ],
  exports: [
    GraphqlConfigModule,
    JwtConfigModule,
    RedisConfigModule,
    PubSubModule,
  ],
})
export class CoreModule {}
