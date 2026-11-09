import { Module } from '@nestjs/common';

import { CartCleanupService } from './cart-cleanup.service';
import { CartResolver } from './cart.resolver';
import { CartService } from './cart.service';

@Module({
  providers: [CartResolver, CartService, CartCleanupService],
  exports: [CartService],
})
export class CartModule {}
