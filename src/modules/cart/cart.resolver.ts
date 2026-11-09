import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';

import { ONE_MINUTE } from '@/common/constants';

import { CartService } from './cart.service';
import {
  AddCartItemInput,
  ApplyCartCouponInput,
  UpdateCartItemInput,
} from './dto/cart.input';
import { Cart } from './entities/cart.entity';

/** API giỏ hàng công khai, định danh bằng `cartToken`. */
@Resolver(() => Cart)
@Throttle({ default: { ttl: ONE_MINUTE, limit: 120 } })
export class CartResolver {
  constructor(private readonly cartService: CartService) {}

  @Query(() => Cart, {
    name: 'cart',
    nullable: true,
    description: 'null nếu token không tồn tại hoặc giỏ đã checkout',
  })
  cart(@Args('cartToken') cartToken: string) {
    return this.cartService.get(cartToken);
  }

  @Mutation(() => Cart, { name: 'addCartItem' })
  addCartItem(@Args('input') input: AddCartItemInput) {
    return this.cartService.addItem(input);
  }

  @Mutation(() => Cart, { name: 'updateCartItem' })
  updateCartItem(@Args('input') input: UpdateCartItemInput) {
    return this.cartService.updateItem(input);
  }

  @Mutation(() => Cart, { name: 'removeCartItem' })
  removeCartItem(
    @Args('cartToken') cartToken: string,
    @Args('variantId', { type: () => ID }) variantId: string,
  ) {
    return this.cartService.removeItem(cartToken, variantId);
  }

  @Mutation(() => Cart, { name: 'applyCartCoupon' })
  applyCartCoupon(@Args('input') input: ApplyCartCouponInput) {
    return this.cartService.applyCoupon(input);
  }

  @Mutation(() => Cart, { name: 'removeCartCoupon' })
  removeCartCoupon(@Args('cartToken') cartToken: string) {
    return this.cartService.removeCoupon(cartToken);
  }
}
