import { Module } from '@nestjs/common';

import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { ViewerService } from './viewer.service';

@Module({
  providers: [AuthService, AuthResolver, ViewerService],
  exports: [AuthService, ViewerService],
})
export class AuthModule {}
