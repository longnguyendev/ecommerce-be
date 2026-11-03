import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppConfig } from '@/common/config/app.config';
import { RedisConfig } from '@/common/config/redis.config';

@Injectable()
export class RedisConfigService {
  constructor(private readonly configService: ConfigService<AppConfig>) {}

  create(): RedisConfig {
    return this.configService.get('redis', { infer: true })!;
  }
}
