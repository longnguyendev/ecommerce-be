import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Paginated, PaginationArgs } from '@/common/pagination';
import { UserRole } from '@/generated/prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateProductInput } from './dto/create-product.input';
import { ProductFilterInput } from './dto/product-filter.input';
import { UpdateProductInput } from './dto/update-product.input';
import { Product } from './entities/product.entity';
import { ProductService } from './product.service';

const PaginatedProduct = Paginated(Product);

@Resolver(() => Product)
export class ProductResolver {
  constructor(private readonly productService: ProductService) {}

  @Query(() => PaginatedProduct, { name: 'products' })
  products(
    @Args('pagination', { nullable: true }) pagination?: PaginationArgs,
    @Args('filter', { nullable: true }) filter?: ProductFilterInput,
  ) {
    return this.productService.findAll(pagination, filter);
  }

  @Query(() => Product, { name: 'product' })
  product(@Args('id', { type: () => ID }) id: string) {
    return this.productService.findOne(id);
  }

  @Query(() => Product, { name: 'productBySlug' })
  productBySlug(@Args('slug') slug: string) {
    return this.productService.findBySlug(slug);
  }

  @Mutation(() => Product, { name: 'createProduct' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  createProduct(@Args('input') input: CreateProductInput) {
    return this.productService.create(input);
  }

  @Mutation(() => Product, { name: 'updateProduct' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateProduct(@Args('input') input: UpdateProductInput) {
    return this.productService.update(input);
  }

  @Mutation(() => Boolean, { name: 'deleteProduct' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  deleteProduct(@Args('id', { type: () => ID }) id: string) {
    return this.productService.remove(id);
  }
}
