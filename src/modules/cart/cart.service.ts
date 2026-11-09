import { randomBytes } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';

import {
  CART_MAX_LINE_QUANTITY,
  FREE_SHIPPING_THRESHOLD,
  I18N_KEYS,
} from '@/common/constants';
import { AppException } from '@/common/exceptions';
import { ProductStatus } from '@/common/graphql/prisma-enums';
import { CartStatus, Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

import { evaluateCoupon } from '../coupon/coupon-pricing';
import {
  attributeValue,
  COLOR_ATTRIBUTE,
  shippingFeeFor,
  SIZE_ATTRIBUTE,
  variantImage,
  variantSnapshotInclude,
  type SnapshotVariant,
} from '../order/order-pricing';
import {
  AddCartItemInput,
  ApplyCartCouponInput,
  UpdateCartItemInput,
} from './dto/cart.input';
import { Cart, CartLine, CartLineIssue } from './entities/cart.entity';

const cartInclude = {
  items: {
    orderBy: { addedAt: 'asc' },
    include: { variant: { include: variantSnapshotInclude } },
  },
} satisfies Prisma.CartInclude;

type LoadedCart = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  /** Giỏ đang hoạt động theo token; null nếu không có hoặc đã checkout. */
  async get(token: string): Promise<Cart | null> {
    const cart = await this.load(token);

    return cart ? this.view(cart) : null;
  }

  async addItem(input: AddCartItemInput): Promise<Cart> {
    const variant = await this.findSellableVariant(input.variantId);
    const existing = input.cartToken ? await this.load(input.cartToken) : null;
    const cartId =
      existing?.id ??
      (
        await this.prisma.cart.create({
          data: { token: randomBytes(32).toString('base64url') },
        })
      ).id;

    const current =
      existing?.items.find((item) => item.variantId === variant.id)?.quantity ??
      0;
    const quantity = current + input.quantity;

    this.assertQuantity(variant, quantity);

    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId, variantId: variant.id } },
      create: { cartId, variantId: variant.id, quantity },
      update: { quantity },
    });

    return this.reload(cartId);
  }

  async updateItem(input: UpdateCartItemInput): Promise<Cart> {
    const cart = await this.loadOrThrow(input.cartToken);
    const line = cart.items.find((item) => item.variantId === input.variantId);

    if (input.quantity === 0) {
      if (line) {
        await this.prisma.cartItem.delete({ where: { id: line.id } });
      }

      return this.reload(cart.id);
    }

    if (!line) {
      throw this.unavailable(input.variantId);
    }

    // Cho phép giảm số lượng kể cả khi đang vượt tồn; chỉ chặn khi tăng.
    if (input.quantity > line.quantity) {
      const variant = await this.findSellableVariant(input.variantId);
      this.assertQuantity(variant, input.quantity);
    }

    await this.prisma.cartItem.update({
      where: { id: line.id },
      data: { quantity: input.quantity },
    });

    return this.reload(cart.id);
  }

  async removeItem(cartToken: string, variantId: string): Promise<Cart> {
    return this.updateItem({ cartToken, variantId, quantity: 0 });
  }

  async applyCoupon(input: ApplyCartCouponInput): Promise<Cart> {
    const cart = await this.loadOrThrow(input.cartToken);
    const { coupon } = await evaluateCoupon(
      this.prisma,
      input.code,
      this.subtotal(cart),
    );

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponCode: coupon.code },
    });

    return this.reload(cart.id);
  }

  async removeCoupon(cartToken: string): Promise<Cart> {
    const cart = await this.loadOrThrow(cartToken);

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponCode: null },
    });

    return this.reload(cart.id);
  }

  // ───────── internals ─────────

  private load(token: string): Promise<LoadedCart | null> {
    return this.prisma.cart.findFirst({
      where: { token, status: CartStatus.ACTIVE },
      include: cartInclude,
    });
  }

  private async loadOrThrow(token: string): Promise<LoadedCart> {
    const cart = await this.load(token);

    if (!cart) {
      throw new AppException(
        'NOT_FOUND',
        I18N_KEYS.ERRORS.BUSINESS.CART.NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }

    return cart;
  }

  private async reload(cartId: string): Promise<Cart> {
    const cart = await this.prisma.cart.update({
      where: { id: cartId },
      data: { updatedAt: new Date() },
      include: cartInclude,
    });

    return this.view(cart);
  }

  private async findSellableVariant(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { status: true, deletedAt: true } } },
    });

    if (!variant || !this.isSellable(variant)) {
      throw this.unavailable(variantId);
    }

    return variant;
  }

  private isSellable(variant: {
    isActive: boolean;
    deletedAt: Date | null;
    product: { status: ProductStatus; deletedAt: Date | null };
  }): boolean {
    return (
      variant.isActive &&
      !variant.deletedAt &&
      !variant.product.deletedAt &&
      variant.product.status === ProductStatus.ACTIVE
    );
  }

  private assertQuantity(
    variant: { id: string; stockQuantity: number },
    quantity: number,
  ): void {
    if (quantity > CART_MAX_LINE_QUANTITY) {
      throw new AppException(
        'BAD_USER_INPUT',
        I18N_KEYS.ERRORS.BUSINESS.CART.MAX_QUANTITY,
        HttpStatus.BAD_REQUEST,
        { variantId: variant.id, max: CART_MAX_LINE_QUANTITY },
      );
    }

    if (quantity > variant.stockQuantity) {
      throw new AppException(
        'CONFLICT',
        I18N_KEYS.ERRORS.BUSINESS.CART.INSUFFICIENT_STOCK,
        HttpStatus.CONFLICT,
        {
          variantId: variant.id,
          available: variant.stockQuantity,
          requested: quantity,
        },
      );
    }
  }

  private unavailable(variantId: string): AppException {
    return new AppException(
      'BAD_USER_INPUT',
      I18N_KEYS.ERRORS.BUSINESS.CART.VARIANT_UNAVAILABLE,
      HttpStatus.BAD_REQUEST,
      { variantId },
    );
  }

  private subtotal(cart: LoadedCart): number {
    return cart.items.reduce(
      (sum, item) => sum + item.variant.price * item.quantity,
      0,
    );
  }

  private line(variant: SnapshotVariant, quantity: number): CartLine {
    const sellable = this.isSellable(variant);
    const stock = Math.max(0, variant.stockQuantity);
    let issue: CartLineIssue | null = null;

    if (!sellable) {
      issue = CartLineIssue.UNAVAILABLE;
    } else if (stock === 0) {
      issue = CartLineIssue.OUT_OF_STOCK;
    } else if (stock < quantity) {
      issue = CartLineIssue.INSUFFICIENT_STOCK;
    }

    return {
      variantId: variant.id,
      productId: variant.productId,
      productName: variant.product.name,
      productSlug: variant.product.slug,
      sku: variant.sku,
      color: attributeValue(variant, COLOR_ATTRIBUTE),
      size: attributeValue(variant, SIZE_ATTRIBUTE),
      image: variantImage(variant),
      unitPrice: variant.price,
      compareAtPrice: variant.compareAtPrice,
      quantity,
      maxQuantity: sellable ? Math.min(stock, CART_MAX_LINE_QUANTITY) : 0,
      lineTotal: variant.price * quantity,
      issue,
    };
  }

  private async view(cart: LoadedCart): Promise<Cart> {
    const items = cart.items.map((item) =>
      this.line(item.variant, item.quantity),
    );
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    let discountAmount = 0;
    let couponError: string | null = null;

    if (cart.couponCode && items.length > 0) {
      try {
        ({ discountAmount } = await evaluateCoupon(
          this.prisma,
          cart.couponCode,
          subtotal,
        ));
      } catch (error) {
        if (!(error instanceof AppException)) throw error;
        couponError = error.i18nKey;
      }
    }

    const shippingFee = shippingFeeFor(subtotal - discountAmount);

    return {
      token: cart.token,
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      couponCode: cart.couponCode,
      couponError,
      discountAmount,
      shippingFee,
      total: subtotal - discountAmount + shippingFee,
      freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
      canCheckout:
        items.length > 0 && !couponError && items.every((item) => !item.issue),
    };
  }
}
