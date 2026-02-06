import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { HashService } from 'src/hash/hash.service';
import { RedisService } from 'src/redis/redis.service';
import { UserRole } from 'src/generated-types/user';
import type { RefreshTokensResponse } from 'src/generated-types/auth';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  constructor(
    private readonly hashService: HashService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  public refreshKey(userId: string, sessionId: string) {
    return `refresh:${userId}:${sessionId}`;
  }

  async verifyJwtToken<T extends object>(token: string, isAccessToken = false): Promise<T> {
    const secret = isAccessToken
      ? this.configService.get<string>('JWT_ACCESS_SECRET')
      : this.configService.get<string>('JWT_REFRESH_SECRET');

    return this.jwtService.verifyAsync<T>(token, { secret });
  }

  async generateJwtTokens({
    userId,
    isBanned,
    role,
    sid,
  }: {
    userId: string;
    isBanned: boolean;
    role: UserRole;
    sid?: string;
  }): Promise<RefreshTokensResponse> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, isBanned, role, sid },
        {
          secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
          expiresIn: this.configService.get<number>('JWT_ACCESS_EXPIRATION'),
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, isBanned, role, sid },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get<number>('JWT_REFRESH_EXPIRATION'),
        },
      ),
    ]);

    const hash = await this.hashService.create(refreshToken);

    await this.redisService.set(
      this.refreshKey(userId, sid ?? ''),
      hash,
      'EX',
      this.configService.getOrThrow<number>('JWT_REFRESH_EXPIRATION'),
    );
    return { accessToken, refreshToken };
  }
}
