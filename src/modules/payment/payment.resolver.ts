import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Paginated, PaginationArgs } from '@/common/pagination';
import { UserRole } from '@/generated/prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreatePaymentInput } from './dto/create-payment.input';
import { PaymentFilterInput } from './dto/payment-filter.input';
import { UpdatePaymentStatusInput } from './dto/update-payment-status.input';
import { Payment } from './entities/payment.entity';
import { PaymentService } from './payment.service';

const PaginatedPayment = Paginated(Payment);

@Resolver(() => Payment)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class PaymentResolver {
  constructor(private readonly paymentService: PaymentService) {}

  @Query(() => PaginatedPayment, { name: 'payments' })
  payments(
    @Args('pagination', { nullable: true }) pagination?: PaginationArgs,
    @Args('filter', { nullable: true }) filter?: PaymentFilterInput,
  ) {
    return this.paymentService.findAll(pagination, filter);
  }

  @Query(() => Payment, { name: 'payment' })
  payment(@Args('id', { type: () => ID }) id: string) {
    return this.paymentService.findOne(id);
  }

  @Mutation(() => Payment, { name: 'createPayment' })
  createPayment(@Args('input') input: CreatePaymentInput) {
    return this.paymentService.create(input);
  }

  @Mutation(() => Payment, { name: 'updatePaymentStatus' })
  updatePaymentStatus(@Args('input') input: UpdatePaymentStatusInput) {
    return this.paymentService.updateStatus(input);
  }
}
