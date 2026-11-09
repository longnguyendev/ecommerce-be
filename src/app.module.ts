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
import { AttributeModule } from './modules/attribute/attribute.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoryModule } from './modules/category/category.module';
import { CollectionModule } from './modules/collection/collection.module';
import { CouponModule } from './modules/coupon/coupon.module';
import { CustomerModule } from './modules/customer/customer.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ProductImageModule } from './modules/product-image/product-image.module';
import { ProductVariantModule } from './modules/product-variant/product-variant.module';
import { ProductModule } from './modules/product/product.module';
import { UploadModule } from './modules/upload/upload.module';
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
    ThrottlerModule.forRoot([{ ttl: FIVE_MINUTES, limit: 1000 }]),
    CoreModule,
    PrismaModule,
    AuthModule,
    UploadModule,
    CategoryModule,
    CollectionModule,
    ProductModule,
    ProductVariantModule,
    ProductImageModule,
    AttributeModule,
    CustomerModule,
    CouponModule,
    InventoryModule,
    OrderModule,
    PaymentModule,
  ],
  controllers: [HealthController],
  providers: [
    HealthResolver,
    { provide: APP_GUARD, useClass: GqlThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: PrismaErrorInterceptor },
  ],
})
export class AppModule {}
