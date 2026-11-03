import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis, { type RedisOptions } from 'ioredis';

import { MODULE_OPTIONS_TOKEN } from './redis.module-definition';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  constructor(@Inject(MODULE_OPTIONS_TOKEN) options: RedisOptions) {
    super(options);
  }

  async onModuleDestroy(): Promise<void> {
    await this.quit();
  }
}
