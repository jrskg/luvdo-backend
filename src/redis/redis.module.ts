import { Global, Module } from '@nestjs/common';

// This module is intentionally minimal — the Redis adapter is wired in main.ts
// via RedisIoAdapter. Global module kept for future Redis-specific providers (caching etc.)
@Global()
@Module({})
export class RedisModule {}
