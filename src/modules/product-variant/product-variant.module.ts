import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductVariantResolver } from './product-variant.resolver';
import { ProductVariantService } from './product-variant.service';

@Module({
  imports: [AuthModule, InventoryModule],
  providers: [ProductVariantResolver, ProductVariantService],
  exports: [ProductVariantService],
})
export class ProductVariantModule {}
