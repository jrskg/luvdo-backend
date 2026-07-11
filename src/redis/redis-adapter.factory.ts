import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(
    app: INestApplication,
    private readonly configService: ConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);

    const pubClient = new Redis({ host, port });
    const subClient = pubClient.duplicate();

    await Promise.all([
      new Promise<void>((res, rej) => {
        pubClient.on('ready', res);
        pubClient.on('error', rej);
      }),
      new Promise<void>((res, rej) => {
        subClient.on('ready', res);
        subClient.on('error', rej);
      }),
    ]);

    this.adapterConstructor = createAdapter(pubClient as any, subClient as any);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
