import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisConfigService } from './redis-config.service';
import { RedisModule } from './redis.module';

@Global()
@Module({
  imports: [
    RedisModule.registerAsync({
      inject: [ConfigService],
      useClass: RedisConfigService,
    }),
  ],
  exports: [RedisModule],
})
export class RedisConfigModule {}
