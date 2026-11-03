import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';
import { IsEnum, IsInt, IsString, Max, Min } from 'class-validator';

import { validateConfig } from '@/helpers/validate';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export interface ServerConfig {
  port: number;
  mode: NodeEnv;
  feHost: string;
}

class ServerVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  APP_PORT!: number;

  @IsEnum(NodeEnv)
  NODE_ENV!: NodeEnv;

  @IsString()
  FE_HOST!: string;
}

export default registerAs<ServerConfig>('server', () => {
  const env = validateConfig(process.env, ServerVariables);
  Logger.debug('Loaded server config');
  return {
    port: env.APP_PORT,
    mode: env.NODE_ENV,
    feHost: env.FE_HOST,
  };
});
