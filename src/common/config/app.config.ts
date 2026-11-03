import { DatabaseConfig } from './database.config';
import { GraphQLConfig } from './graphql.config';
import { JwtConfig } from './jwt.config';
import { RedisConfig } from './redis.config';
import { ServerConfig } from './server.config';

export interface AppConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  graphql: GraphQLConfig;
  jwt: JwtConfig;
  redis: RedisConfig;
}
