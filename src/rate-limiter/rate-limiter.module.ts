import { Module } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { RateLimiterService } from './rate-limiter.service';

@Module({
  providers: [RateLimiterService, RedisService],
  exports: [RateLimiterService],
})
export class RateLimiterModule {}
