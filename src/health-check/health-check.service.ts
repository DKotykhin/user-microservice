import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name);
  constructor(private readonly prisma: PrismaService) {}

  async checkDatabaseConnection(): Promise<boolean> {
    this.logger.log('Checking database connection...');
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      this.logger.log('Database connection is healthy.');
      return true;
    } catch (error) {
      this.logger.error(`Database connection failed: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }
}
