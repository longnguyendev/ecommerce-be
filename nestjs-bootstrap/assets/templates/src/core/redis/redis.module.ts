import { Global, Module } from '@nestjs/common';

import { ConfigurableModuleClass } from './redis.module-definition';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule extends ConfigurableModuleClass {}
