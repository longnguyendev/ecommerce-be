import { Module } from '@nestjs/common';

import { CouponResolver } from './coupon.resolver';
import { CouponService } from './coupon.service';

@Module({
  providers: [CouponResolver, CouponService],
  exports: [CouponService],
})
export class CouponModule {}
