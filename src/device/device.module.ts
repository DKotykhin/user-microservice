import { Module } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { DeviceService } from './device.service';

@Module({
  providers: [DeviceService, RedisService],
  exports: [DeviceService],
})
export class DeviceModule {}
