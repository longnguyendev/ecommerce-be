import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Paginated, PaginationArgs } from '@/common/pagination';
import { UserRole } from '@/generated/prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateProductImageInput } from './dto/create-product-image.input';
import { ProductImageFilterInput } from './dto/product-image-filter.input';
import { ReorderProductImagesInput } from './dto/reorder-product-images.input';
import { UpdateProductImageInput } from './dto/update-product-image.input';
import { ProductImage } from './entities/product-image.entity';
import { ProductImageService } from './product-image.service';

const PaginatedProductImage = Paginated(ProductImage);

@Resolver(() => ProductImage)
export class ProductImageResolver {
  constructor(private readonly productImageService: ProductImageService) {}

  @Query(() => PaginatedProductImage, { name: 'productImages' })
  productImages(
    @Args('pagination', { nullable: true }) pagination?: PaginationArgs,
    @Args('filter', { nullable: true }) filter?: ProductImageFilterInput,
  ) {
    return this.productImageService.findAll(pagination, filter);
  }

  @Query(() => ProductImage, { name: 'productImage' })
  productImage(@Args('id', { type: () => ID }) id: string) {
    return this.productImageService.findOne(id);
  }

  @Mutation(() => ProductImage, { name: 'createProductImage' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  createProductImage(@Args('input') input: CreateProductImageInput) {
    return this.productImageService.create(input);
  }

  @Mutation(() => ProductImage, { name: 'updateProductImage' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateProductImage(@Args('input') input: UpdateProductImageInput) {
    return this.productImageService.update(input);
  }

  @Mutation(() => Boolean, { name: 'deleteProductImage' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  deleteProductImage(@Args('id', { type: () => ID }) id: string) {
    return this.productImageService.remove(id);
  }

  @Mutation(() => [ProductImage], { name: 'reorderProductImages' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  reorderProductImages(@Args('input') input: ReorderProductImagesInput) {
    return this.productImageService.reorder(input);
  }

  @Mutation(() => ProductImage, { name: 'setPrimaryProductImage' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  setPrimaryProductImage(@Args('id', { type: () => ID }) id: string) {
    return this.productImageService.setPrimary(id);
  }
}
