import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Paginated, PaginationArgs } from '@/common/pagination';
import { UserRole } from '@/generated/prisma/client';

import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  AdjustStockInput,
  InventoryFilterInput,
  PurchaseReceiptFilterInput,
  StockMovementFilterInput,
} from './dto/inventory-filters.input';
import {
  CreatePurchaseReceiptInput,
  UpdatePurchaseReceiptInput,
} from './dto/purchase-receipt.input';
import {
  InventoryVariant,
  PurchaseReceipt,
  StockMovement,
} from './entities/inventory.entities';
import { InventoryService } from './inventory.service';

const PaginatedInventoryVariant = Paginated(InventoryVariant);
const PaginatedStockMovement = Paginated(StockMovement);
const PaginatedPurchaseReceipt = Paginated(PurchaseReceipt);

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class InventoryResolver {
  constructor(private readonly inventory: InventoryService) {}

  @Query(() => PaginatedInventoryVariant, { name: 'inventoryVariants' })
  inventoryVariants(
    @Args('pagination', { nullable: true }) pagination?: PaginationArgs,
    @Args('filter', { nullable: true }) filter?: InventoryFilterInput,
  ) {
    return this.inventory.inventoryVariants(pagination, filter);
  }

  @Query(() => PaginatedStockMovement, { name: 'stockMovements' })
  stockMovements(
    @Args('pagination', { nullable: true }) pagination?: PaginationArgs,
    @Args('filter', { nullable: true }) filter?: StockMovementFilterInput,
  ) {
    return this.inventory.movements(pagination, filter);
  }

  @Query(() => PaginatedPurchaseReceipt, { name: 'purchaseReceipts' })
  purchaseReceipts(
    @Args('pagination', { nullable: true }) pagination?: PaginationArgs,
    @Args('filter', { nullable: true }) filter?: PurchaseReceiptFilterInput,
  ) {
    return this.inventory.receipts(pagination, filter);
  }

  @Query(() => PurchaseReceipt, { name: 'purchaseReceipt' })
  purchaseReceipt(@Args('id', { type: () => ID }) id: string) {
    return this.inventory.receipt(id);
  }

  @Mutation(() => PurchaseReceipt, { name: 'createPurchaseReceipt' })
  createPurchaseReceipt(
    @Args('input') input: CreatePurchaseReceiptInput,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.inventory.createReceipt(input, user?.sub);
  }

  @Mutation(() => PurchaseReceipt, { name: 'updatePurchaseReceipt' })
  updatePurchaseReceipt(@Args('input') input: UpdatePurchaseReceiptInput) {
    return this.inventory.updateReceipt(input);
  }

  @Mutation(() => PurchaseReceipt, { name: 'confirmPurchaseReceipt' })
  confirmPurchaseReceipt(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.inventory.confirmReceipt(id, user?.sub);
  }

  @Mutation(() => PurchaseReceipt, { name: 'revertPurchaseReceipt' })
  revertPurchaseReceipt(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.inventory.revertReceipt(id, user?.sub);
  }

  @Mutation(() => PurchaseReceipt, { name: 'cancelPurchaseReceipt' })
  cancelPurchaseReceipt(@Args('id', { type: () => ID }) id: string) {
    return this.inventory.cancelReceipt(id);
  }

  @Mutation(() => InventoryVariant, { name: 'adjustStock' })
  adjustStock(
    @Args('input') input: AdjustStockInput,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.inventory.adjustStock(input, user?.sub);
  }
}
