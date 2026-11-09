import { Module } from '@nestjs/common';

import { AddressResolver } from './address.resolver';
import { AddressService } from './address.service';

@Module({
  providers: [AddressResolver, AddressService],
  exports: [AddressService],
})
export class AddressModule {}
