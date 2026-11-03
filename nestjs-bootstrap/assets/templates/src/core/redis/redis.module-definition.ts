import { ConfigurableModuleBuilder } from '@nestjs/common';

import { RedisConfig } from '@/common/config/redis.config';

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<RedisConfig>().build();
