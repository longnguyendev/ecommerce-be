import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AppConfig } from './common/config/app.config';
import { AllExceptionsFilter } from './common/filters/all-exception.filter';
import { createValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
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

  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  await app.listen(port);
  Logger.log(`Listening on http://localhost:${port} (${mode})`, 'Bootstrap');
}

void bootstrap();
