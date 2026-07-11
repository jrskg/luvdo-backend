import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './redis/redis-adapter.factory';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const corsOrigins = configService
    .get<string>('CORS_ORIGINS', 'http://localhost:8081')
    .split(',')
    .map((o) => o.trim());
  const redisEnabled = configService.get<string>('REDIS_ENABLED', 'false') === 'true';

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: corsOrigins, credentials: false });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  if (redisEnabled) {
    const redisAdapter = new RedisIoAdapter(app, configService);
    await redisAdapter.connectToRedis();
    app.useWebSocketAdapter(redisAdapter);
    console.log('Redis Socket.io adapter enabled');
  }

  await app.listen(port);
  console.log(`Luvdo backend running on http://localhost:${port}`);
}

bootstrap();
