import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { AppError } from 'src/utils/errors/app-error';

@Injectable()
export class HashService {
  private readonly index = 10;
  private readonly logger = new Logger(HashService.name);

  async create(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(this.index);
    const passwordHash = await bcrypt.hash(password, salt);
    if (!passwordHash) {
      this.logger.error('Failed to create password hash');
      throw AppError.forbidden("Can't create password hash");
    }
    return passwordHash;
  }

  async compare(password: string, passwordHash: string): Promise<boolean> {
    return await bcrypt.compare(password, passwordHash);
  }

  async theSame(password: string, passwordHash: string): Promise<boolean> {
    const isSame = await bcrypt.compare(password, passwordHash);
    if (isSame) {
      this.logger.warn('New password must be different from the old one');
      throw AppError.badRequest('New password must be different from the old one');
    }
    return isSame;
  }

  async validate(token: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(token, hash);
  }
}
