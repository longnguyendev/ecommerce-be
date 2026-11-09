import { Module } from '@nestjs/common';

import { AddressModule } from '../address/address.module';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationModule } from '../notification/notification.module';
import { OrderResolver } from './order.resolver';
import { OrderService } from './order.service';
import { StorefrontOrderResolver } from './storefront-order.resolver';

@Module({
  imports: [AddressModule, InventoryModule, NotificationModule],
  providers: [OrderResolver, StorefrontOrderResolver, OrderService],
  exports: [OrderService],
})
export class OrderModule {}
