import { join } from 'node:path';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AppConfig } from './common/config/app.config';
import { AllExceptionsFilter } from './common/filters/all-exception.filter';
import { createValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<AppConfig>);

  const port = config.get('server.port', { infer: true })!;
  const mode = config.get('server.mode', { infer: true })!;
  const feHost = config.get('server.feHost', { infer: true })!;

  app.use(
    helmet({
      contentSecurityPolicy: mode === 'production' ? undefined : false,
    }),
  );
  app.enableCors({
    origin: mode === 'production' ? [feHost] : true,
    credentials: true,
  });

  // Serve uploaded images from ./uploads at /uploads/<subdir>/<file>.
  // helmet mặc định chặn tài nguyên cross-origin (CORP same-origin) nên cho phép riêng với ảnh,
  // để storefront/admin chạy ở origin khác vẫn hiển thị được.
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });

  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  await app.listen(port);
  Logger.log(`Listening on http://localhost:${port} (${mode})`, 'Bootstrap');
}

void bootstrap();
