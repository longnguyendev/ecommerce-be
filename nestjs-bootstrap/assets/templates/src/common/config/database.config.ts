import { validateConfig } from '@/helpers/validate';
import { registerAs } from '@nestjs/config';
import { IsString } from 'class-validator';

export interface DatabaseConfig {
  connectionString: string;
}

class DatabaseVariables {
  @IsString()
  DATABASE_URL!: string;
}

export default registerAs<DatabaseConfig>('database', () => {
  const env = validateConfig(process.env, DatabaseVariables);
  return { connectionString: env.DATABASE_URL };
});
