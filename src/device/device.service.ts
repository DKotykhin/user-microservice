import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import * as crypto from 'crypto';

export interface DeviceInfo {
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  lastUsed: Date;
  firstSeen: Date;
}

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);
  private readonly DEVICE_TTL = 30 * 24 * 60 * 60; // 30 days

  constructor(private readonly redisService: RedisService) {}

  /**
   * Generate a unique device fingerprint based on IP and User-Agent
   */
  generateDeviceId(ipAddress: string, userAgent: string): string {
    return crypto.createHash('sha256').update(`${ipAddress}:${userAgent}`).digest('hex').substring(0, 16);
  }

  private getDevicesKey(userId: string): string {
    return `user_devices:${userId}`;
  }

  /**
   * Check if this is a known device for the user
   */
  async isKnownDevice(userId: string, deviceId: string): Promise<boolean> {
    const key = this.getDevicesKey(userId);
    const exists = await this.redisService.hexists(key, deviceId);
    return exists === 1;
  }

  /**
   * Register a new device for the user
   */
  async registerDevice(userId: string, deviceInfo: Omit<DeviceInfo, 'firstSeen' | 'lastUsed'>): Promise<void> {
    const key = this.getDevicesKey(userId);
    const now = new Date();

    const device: DeviceInfo = {
      ...deviceInfo,
      firstSeen: now,
      lastUsed: now,
    };

    await this.redisService.hset(key, deviceInfo.deviceId, JSON.stringify(device));
    await this.redisService.expire(key, this.DEVICE_TTL);

    this.logger.log(`Registered new device ${deviceInfo.deviceId} for user ${userId}`);
  }

  /**
   * Update last used timestamp for a known device
   */
  async updateDeviceLastUsed(userId: string, deviceId: string): Promise<void> {
    const key = this.getDevicesKey(userId);
    const deviceJson = await this.redisService.hget(key, deviceId);

    if (deviceJson) {
      const device = JSON.parse(deviceJson) as DeviceInfo;
      device.lastUsed = new Date();
      await this.redisService.hset(key, deviceId, JSON.stringify(device));
      await this.redisService.expire(key, this.DEVICE_TTL);
    }
  }

  /**
   * Get all registered devices for a user
   */
  async getUserDevices(userId: string): Promise<DeviceInfo[]> {
    const key = this.getDevicesKey(userId);
    const devices = await this.redisService.hgetall(key);

    return Object.values(devices).map((json) => JSON.parse(json) as DeviceInfo);
  }

  /**
   * Remove a specific device
   */
  async removeDevice(userId: string, deviceId: string): Promise<void> {
    const key = this.getDevicesKey(userId);
    await this.redisService.hdel(key, deviceId);
    this.logger.log(`Removed device ${deviceId} for user ${userId}`);
  }

  /**
   * Remove all devices for a user (useful on password change)
   */
  async removeAllDevices(userId: string): Promise<void> {
    const key = this.getDevicesKey(userId);
    await this.redisService.del(key);
    this.logger.log(`Removed all devices for user ${userId}`);
  }
}
