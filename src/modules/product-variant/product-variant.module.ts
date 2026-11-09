import { Module } from '@nestjs/common';

import { InventoryModule } from '../inventory/inventory.module';
import { ProductVariantResolver } from './product-variant.resolver';
import { ProductVariantService } from './product-variant.service';

@Module({
  imports: [InventoryModule],
  providers: [ProductVariantResolver, ProductVariantService],
  exports: [ProductVariantService],
})
export class ProductVariantModule {}
