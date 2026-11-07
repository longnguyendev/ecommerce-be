import { Module } from '@nestjs/common';

import { AttributeResolver } from './attribute.resolver';
import { AttributeService } from './attribute.service';

@Module({
  providers: [AttributeResolver, AttributeService],
  exports: [AttributeService],
})
export class AttributeModule {}
