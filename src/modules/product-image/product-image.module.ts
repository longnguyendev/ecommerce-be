import { Module } from '@nestjs/common';

import { ProductImageResolver } from './product-image.resolver';
import { ProductImageService } from './product-image.service';

@Module({
  providers: [ProductImageResolver, ProductImageService],
  exports: [ProductImageService],
})
export class ProductImageModule {}
