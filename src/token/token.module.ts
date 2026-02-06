import { Module } from '@nestjs/common';

import { HashService } from 'src/hash/hash.service';
import { TokenService } from './token.service';

@Module({
  imports: [],
  controllers: [],
  providers: [HashService, TokenService],
})
export class TokenModule {}
