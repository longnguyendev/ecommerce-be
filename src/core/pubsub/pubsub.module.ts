import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

import type { AppConfig } from '@/common/config/app.config';

/** Token inject PubSub dùng cho GraphQL subscription. */
export const PUB_SUB = Symbol('PUB_SUB');

/**
 * PubSub trên Redis: sự kiện phát ở instance nào cũng tới được admin đang kết
 * nối ở instance khác. Redis yêu cầu connection riêng cho subscriber.
 */
@Global()
@Module({
  providers: [
    {
      provide: PUB_SUB,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig>) => {
        const options = config.get('redis', { infer: true })!;
        const logger = new Logger('PubSub');
        const connect = (role: string) => {
          const client = new Redis({
            host: options.host,
            port: options.port,
            retryStrategy: (times) => Math.min(times * 200, 5_000),
          });
          client.on('error', (error) =>
            logger.warn(`Redis ${role}: ${error.message}`),
          );
          return client;
        };

        return new RedisPubSub({
          publisher: connect('publisher'),
          subscriber: connect('subscriber'),
        });
      },
    },
  ],
  exports: [PUB_SUB],
})
export class PubSubModule implements OnApplicationShutdown {
  constructor(@Inject(PUB_SUB) private readonly pubSub: RedisPubSub) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pubSub.close();
  }
}
