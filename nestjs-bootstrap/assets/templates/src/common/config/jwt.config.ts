import { validateConfig } from '@/helpers/validate';
import { registerAs } from '@nestjs/config';
import { IsString, MinLength } from 'class-validator';

export interface JwtConfig {
  secret: string;
  expirationTime: string;
  refreshSecret: string;
  refreshExpirationTime: string;
}

class JwtVariables {
  @IsString()
  @MinLength(32)
  JWT_TOKEN_SECRET!: string;

  @IsString()
  JWT_TOKEN_EXPIRATION_TIME!: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_TOKEN_SECRET!: string;

  @IsString()
  JWT_REFRESH_TOKEN_EXPIRATION_TIME!: string;
}

export default registerAs<JwtConfig>('jwt', () => {
  const env = validateConfig(process.env, JwtVariables);

  if (env.JWT_TOKEN_SECRET === env.JWT_REFRESH_TOKEN_SECRET) {
    throw new Error('JWT_TOKEN_SECRET and JWT_REFRESH_TOKEN_SECRET must differ');
  }

  return {
    secret: env.JWT_TOKEN_SECRET,
    expirationTime: env.JWT_TOKEN_EXPIRATION_TIME,
    refreshSecret: env.JWT_REFRESH_TOKEN_SECRET,
    refreshExpirationTime: env.JWT_REFRESH_TOKEN_EXPIRATION_TIME,
  };
});
