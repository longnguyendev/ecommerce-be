import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Paginated, PaginationArgs } from '@/common/pagination';

import { CouponService } from './coupon.service';
import { CouponFilterInput } from './dto/coupon-filter.input';
import { CreateCouponInput } from './dto/create-coupon.input';
import { UpdateCouponInput } from './dto/update-coupon.input';
import { Coupon } from './entities/coupon.entity';

const PaginatedCoupon = Paginated(Coupon);

@Resolver(() => Coupon)
export class CouponResolver {
  constructor(private readonly couponService: CouponService) {}

  @Query(() => PaginatedCoupon, { name: 'coupons' })
  coupons(
    @Args('pagination', { nullable: true }) pagination?: PaginationArgs,
    @Args('filter', { nullable: true }) filter?: CouponFilterInput,
  ) {
    return this.couponService.findAll(pagination, filter);
  }

  @Query(() => Coupon, { name: 'coupon' })
  coupon(@Args('id', { type: () => ID }) id: string) {
    return this.couponService.findOne(id);
  }

  @Query(() => Coupon, { name: 'couponByCode' })
  couponByCode(@Args('code') code: string) {
    return this.couponService.findByCode(code);
  }

  @Mutation(() => Coupon, { name: 'createCoupon' })
  createCoupon(@Args('input') input: CreateCouponInput) {
    return this.couponService.create(input);
  }

  @Mutation(() => Coupon, { name: 'updateCoupon' })
  updateCoupon(@Args('input') input: UpdateCouponInput) {
    return this.couponService.update(input);
  }

  @Mutation(() => Boolean, { name: 'deleteCoupon' })
  deleteCoupon(@Args('id', { type: () => ID }) id: string) {
    return this.couponService.remove(id);
  }
}
