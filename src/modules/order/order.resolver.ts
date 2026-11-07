import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Paginated, PaginationArgs } from '@/common/pagination';

import { CreateOrderInput } from './dto/create-order.input';
import { OrderFilterInput } from './dto/order-filter.input';
import { UpdateOrderStatusInput } from './dto/update-order-status.input';
import { Order } from './entities/order.entity';
import { OrderService } from './order.service';

const PaginatedOrder = Paginated(Order);

@Resolver(() => Order)
export class OrderResolver {
  constructor(private readonly orderService: OrderService) {}

  @Query(() => PaginatedOrder, { name: 'orders' })
  orders(
    @Args('pagination', { nullable: true }) pagination?: PaginationArgs,
    @Args('filter', { nullable: true }) filter?: OrderFilterInput,
  ) {
    return this.orderService.findAll(pagination, filter);
  }

  @Query(() => Order, { name: 'order' })
  order(@Args('id', { type: () => ID }) id: string) {
    return this.orderService.findOne(id);
  }

  @Query(() => Order, { name: 'orderByCode' })
  orderByCode(@Args('orderCode') orderCode: string) {
    return this.orderService.findByCode(orderCode);
  }

  @Mutation(() => Order, { name: 'createOrder' })
  createOrder(@Args('input') input: CreateOrderInput) {
    return this.orderService.create(input);
  }

  @Mutation(() => Order, { name: 'updateOrderStatus' })
  updateOrderStatus(@Args('input') input: UpdateOrderStatusInput) {
    return this.orderService.updateStatus(input);
  }
}
