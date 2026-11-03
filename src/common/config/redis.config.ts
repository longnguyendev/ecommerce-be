import { registerAs } from '@nestjs/config';
import { IsInt, IsString, Max, Min } from 'class-validator';

import { validateConfig } from '@/helpers/validate';

export interface RedisConfig {
  host: string;
  port: number;
}

class RedisVariables {
  @IsString()
  REDIS_HOST!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT!: number;
}

export default registerAs<RedisConfig>('redis', () => {
  const env = validateConfig(process.env, RedisVariables);
  return { host: env.REDIS_HOST, port: env.REDIS_PORT };
});
