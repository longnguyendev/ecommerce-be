import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CheckoutInput } from './dto/checkout.input';
import { PublicOrder } from './entities/public-order.entity';
import { OrderService } from './order.service';

/** API công khai cho khách: đặt hàng từ giỏ và tra cứu đơn. */
@Resolver(() => PublicOrder)
export class StorefrontOrderResolver {
  constructor(private readonly orderService: OrderService) {}

  @Mutation(() => PublicOrder, { name: 'checkout' })
  checkout(@Args('input') input: CheckoutInput) {
    return this.orderService.checkout(input);
  }

  @Query(() => PublicOrder, { name: 'orderLookup' })
  orderLookup(
    @Args('orderCode') orderCode: string,
    @Args('phone') phone: string,
  ) {
    return this.orderService.lookup(orderCode, phone);
  }
}
