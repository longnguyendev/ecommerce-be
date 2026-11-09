import { UseGuards } from '@nestjs/common';
import {
  Args,
  Context,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';

import { Paginated, PaginationArgs } from '@/common/pagination';
import { UserRole } from '@/generated/prisma/client';

import type { AuthenticatedRequest } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ViewerService } from '../auth/viewer.service';
import { CreateProductVariantInput } from './dto/create-product-variant.input';
import { ProductVariantFilterInput } from './dto/product-variant-filter.input';
import { SyncProductVariantsInput } from './dto/sync-product-variants.input';
import { UpdateProductVariantInput } from './dto/update-product-variant.input';
import { ProductVariant } from './entities/product-variant.entity';
import { ProductVariantService } from './product-variant.service';

const PaginatedProductVariant = Paginated(ProductVariant);

@Resolver(() => ProductVariant)
export class ProductVariantResolver {
  constructor(
    private readonly productVariantService: ProductVariantService,
    private readonly viewer: ViewerService,
  ) {}

  /** Giá vốn chỉ trả cho admin; khách / storefront nhận null. */
  @ResolveField('costPrice', () => Int, {
    nullable: true,
    description: 'Giá vốn (VND) — chỉ admin, người khác nhận null',
  })
  async costPrice(
    @Parent() variant: ProductVariant,
    @Context('req') req: AuthenticatedRequest,
  ): Promise<number | null> {
    return (await this.viewer.isAdmin(req)) ? variant.costPrice : null;
  }

  @Query(() => PaginatedProductVariant, { name: 'productVariants' })
  productVariants(
    @Args('pagination', { nullable: true }) pagination?: PaginationArgs,
    @Args('filter', { nullable: true }) filter?: ProductVariantFilterInput,
  ) {
    return this.productVariantService.findAll(pagination, filter);
  }

  @Query(() => ProductVariant, { name: 'productVariant' })
  productVariant(@Args('id', { type: () => ID }) id: string) {
    return this.productVariantService.findOne(id);
  }

  @Mutation(() => ProductVariant, { name: 'createProductVariant' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  createProductVariant(@Args('input') input: CreateProductVariantInput) {
    return this.productVariantService.create(input);
  }

  @Mutation(() => ProductVariant, { name: 'updateProductVariant' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateProductVariant(@Args('input') input: UpdateProductVariantInput) {
    return this.productVariantService.update(input);
  }

  @Mutation(() => [ProductVariant], { name: 'syncProductVariants' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  syncProductVariants(@Args('input') input: SyncProductVariantsInput) {
    return this.productVariantService.sync(input);
  }

  @Mutation(() => Boolean, { name: 'deleteProductVariant' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  deleteProductVariant(@Args('id', { type: () => ID }) id: string) {
    return this.productVariantService.remove(id);
  }
}
