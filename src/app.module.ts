import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import databaseConfig from './common/config/database.config';
import graphqlConfig from './common/config/graphql.config';
import jwtConfig from './common/config/jwt.config';
import redisConfig from './common/config/redis.config';
import serverConfig from './common/config/server.config';
import { FIVE_MINUTES } from './common/constants';
import { HealthController } from './common/health/health.controller';
import { HealthResolver } from './common/health/health.resolver';
import { PrismaErrorInterceptor } from './common/interceptors/prisma-error.interceptor';
import { CoreModule } from './core/core.module';
import { GqlThrottlerGuard } from './guards/gql-throttler.guard';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [
        serverConfig,
        databaseConfig,
        graphqlConfig,
        jwtConfig,
        redisConfig,
      ],
    }),
    ThrottlerModule.forRoot([{ ttl: FIVE_MINUTES, limit: 50 }]),
    CoreModule,
    PrismaModule,
  ],
  controllers: [HealthController],
  providers: [
    HealthResolver,
    { provide: APP_GUARD, useClass: GqlThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: PrismaErrorInterceptor },
  ],
})
export class AppModule {}
