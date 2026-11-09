import { Args, ID, Query, Resolver } from '@nestjs/graphql';

import { AddressService } from './address.service';
import { Province, Ward } from './entities/admin-unit.entity';

/** Danh mục địa chỉ công khai cho form giao hàng. */
@Resolver()
export class AddressResolver {
  constructor(private readonly address: AddressService) {}

  @Query(() => [Province], { name: 'provinces' })
  provinces() {
    return this.address.provinces();
  }

  @Query(() => [Ward], {
    name: 'wards',
    description: 'Xã/phường của một tỉnh, sắp theo tên',
  })
  wards(@Args('provinceCode', { type: () => ID }) provinceCode: string) {
    return this.address.wards(provinceCode);
  }
}
