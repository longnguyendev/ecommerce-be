import { Module } from '@nestjs/common';

import { InventoryModule } from '../inventory/inventory.module';
import { OrderResolver } from './order.resolver';
import { OrderService } from './order.service';

@Module({
  imports: [InventoryModule],
  providers: [OrderResolver, OrderService],
  exports: [OrderService],
})
export class OrderModule {}
