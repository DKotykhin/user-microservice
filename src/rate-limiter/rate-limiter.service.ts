import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { AppError } from 'src/utils/errors/app-error';

export interface RateLimitConfig {
  maxAttempts: number;
  windowSeconds: number;
  lockoutSeconds?: number;
}

export interface FailedAttemptResult {
  currentAttempts: number;
  attemptsLeft: number;
  isLocked: boolean;
  lockoutSeconds?: number;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  constructor(private readonly redisService: RedisService) {}

  private getKey(action: string, identifier: string): string {
    return `rate_limit:${action}:${identifier}`;
  }

  private getLockoutKey(action: string, identifier: string): string {
    return `lockout:${action}:${identifier}`;
  }

  /**
   * Check if the identifier is currently locked out.
   * Call this BEFORE any authentication logic.
   * Does NOT increment the counter.
   */
  async checkLockout(action: string, identifier: string): Promise<void> {
    const lockoutKey = this.getLockoutKey(action, identifier);
    const lockoutTtl = await this.redisService.ttl(lockoutKey);

    if (lockoutTtl > 0) {
      const remainingMinutes = Math.ceil(lockoutTtl / 60);
      this.logger.warn(`Lockout active for ${action}:${identifier}, ${lockoutTtl}s remaining`);
      throw AppError.tooManyRequests(
        `Account is temporarily locked. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`,
      );
    }
  }

  /**
   * Record a failed attempt and apply lockout if max attempts exceeded.
   * Call this AFTER authentication fails (e.g., wrong password).
   * Returns information about remaining attempts and lockout status.
   */
  async recordFailedAttempt(action: string, identifier: string, config: RateLimitConfig): Promise<FailedAttemptResult> {
    const key = this.getKey(action, identifier);
    const lockoutKey = this.getLockoutKey(action, identifier);

    const attempts = await this.redisService.incr(key);

    // Set expiry on first attempt
    if (attempts === 1) {
      await this.redisService.expire(key, config.windowSeconds);
    }

    const attemptsLeft = Math.max(0, config.maxAttempts - attempts);

    // Check if we need to apply lockout
    if (attempts >= config.maxAttempts && config.lockoutSeconds) {
      await this.redisService.setex(lockoutKey, config.lockoutSeconds, '1');
      await this.redisService.del(key);
      this.logger.warn(
        `Lockout applied for ${action}:${identifier} after ${attempts} failed attempts, locked for ${config.lockoutSeconds}s`,
      );
      return {
        currentAttempts: attempts,
        attemptsLeft: 0,
        isLocked: true,
        lockoutSeconds: config.lockoutSeconds,
      };
    }

    this.logger.log(`Failed attempt ${attempts}/${config.maxAttempts} for ${action}:${identifier}`);
    return {
      currentAttempts: attempts,
      attemptsLeft,
      isLocked: false,
    };
  }

  /**
   * Reset the rate limit counter (call on successful authentication).
   */
  async resetRateLimit(action: string, identifier: string): Promise<void> {
    const key = this.getKey(action, identifier);
    const lockoutKey = this.getLockoutKey(action, identifier);
    await this.redisService.del(key);
    await this.redisService.del(lockoutKey);
  }

  /**
   * Get remaining attempts without incrementing the counter.
   */
  async getRemainingAttempts(action: string, identifier: string, maxAttempts: number): Promise<number> {
    const key = this.getKey(action, identifier);
    const attempts = await this.redisService.get(key);
    return Math.max(0, maxAttempts - parseInt(attempts || '0', 10));
  }

  /**
   * Legacy method for simple rate limiting (increments on every call).
   * Use for endpoints like password reset initiation, email resend, etc.
   */
  async checkRateLimit(action: string, identifier: string, config: RateLimitConfig): Promise<void> {
    const lockoutKey = this.getLockoutKey(action, identifier);

    // Check if currently locked out
    const lockoutTtl = await this.redisService.ttl(lockoutKey);
    if (lockoutTtl > 0) {
      const remainingMinutes = Math.ceil(lockoutTtl / 60);
      this.logger.warn(`Rate limit lockout active for ${action}:${identifier}`);
      throw AppError.tooManyRequests(
        `Too many attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`,
      );
    }

    const key = this.getKey(action, identifier);
    const attempts = await this.redisService.incr(key);

    // Set expiry on first attempt
    if (attempts === 1) {
      await this.redisService.expire(key, config.windowSeconds);
    }

    if (attempts > config.maxAttempts) {
      // Apply lockout if configured
      if (config.lockoutSeconds) {
        await this.redisService.setex(lockoutKey, config.lockoutSeconds, '1');
        await this.redisService.del(key);
        this.logger.warn(`Lockout applied for ${action}:${identifier} for ${config.lockoutSeconds}s`);
      }

      throw AppError.tooManyRequests('Too many attempts. Please try again later.');
    }
  }
}
