import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Paginated, PaginationArgs } from '@/common/pagination';
import { UserRole } from '@/generated/prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CustomerService } from './customer.service';
import { CreateCustomerAddressInput } from './dto/create-customer-address.input';
import { CreateCustomerInput } from './dto/create-customer.input';
import { CustomerFilterInput } from './dto/customer-filter.input';
import { UpdateCustomerAddressInput } from './dto/update-customer-address.input';
import { UpdateCustomerInput } from './dto/update-customer.input';
import { CustomerAddress } from './entities/customer-address.entity';
import { Customer } from './entities/customer.entity';

const PaginatedCustomer = Paginated(Customer);

@Resolver(() => Customer)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class CustomerResolver {
  constructor(private readonly customerService: CustomerService) {}

  @Query(() => PaginatedCustomer, { name: 'customers' })
  customers(
    @Args('pagination', { nullable: true }) pagination?: PaginationArgs,
    @Args('filter', { nullable: true }) filter?: CustomerFilterInput,
  ) {
    return this.customerService.findAll(pagination, filter);
  }

  @Query(() => Customer, { name: 'customer' })
  customer(@Args('id', { type: () => ID }) id: string) {
    return this.customerService.findOne(id);
  }

  @Mutation(() => Customer, { name: 'createCustomer' })
  createCustomer(@Args('input') input: CreateCustomerInput) {
    return this.customerService.create(input);
  }

  @Mutation(() => Customer, { name: 'updateCustomer' })
  updateCustomer(@Args('input') input: UpdateCustomerInput) {
    return this.customerService.update(input);
  }

  @Mutation(() => Boolean, { name: 'deleteCustomer' })
  deleteCustomer(@Args('id', { type: () => ID }) id: string) {
    return this.customerService.remove(id);
  }

  @Mutation(() => CustomerAddress, { name: 'createCustomerAddress' })
  createCustomerAddress(@Args('input') input: CreateCustomerAddressInput) {
    return this.customerService.addAddress(input);
  }

  @Mutation(() => CustomerAddress, { name: 'updateCustomerAddress' })
  updateCustomerAddress(@Args('input') input: UpdateCustomerAddressInput) {
    return this.customerService.updateAddress(input);
  }

  @Mutation(() => Boolean, { name: 'deleteCustomerAddress' })
  deleteCustomerAddress(@Args('id', { type: () => ID }) id: string) {
    return this.customerService.removeAddress(id);
  }

  @Mutation(() => CustomerAddress, { name: 'setDefaultCustomerAddress' })
  setDefaultCustomerAddress(
    @Args('customerId', { type: () => ID }) customerId: string,
    @Args('addressId', { type: () => ID }) addressId: string,
  ) {
    return this.customerService.setDefaultAddress(customerId, addressId);
  }
}
