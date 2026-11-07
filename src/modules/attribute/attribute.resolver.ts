import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Paginated, PaginationArgs } from '@/common/pagination';
import { UserRole } from '@/generated/prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AttributeService } from './attribute.service';
import { AttributeFilterInput } from './dto/attribute-filter.input';
import { CreateAttributeValueInput } from './dto/create-attribute-value.input';
import { CreateAttributeInput } from './dto/create-attribute.input';
import { UpdateAttributeValueInput } from './dto/update-attribute-value.input';
import { UpdateAttributeInput } from './dto/update-attribute.input';
import { AttributeValue } from './entities/attribute-value.entity';
import { Attribute } from './entities/attribute.entity';

const PaginatedAttribute = Paginated(Attribute);

@Resolver(() => Attribute)
export class AttributeResolver {
  constructor(private readonly attributeService: AttributeService) {}

  @Query(() => PaginatedAttribute, { name: 'attributes' })
  attributes(
    @Args('pagination', { nullable: true }) pagination?: PaginationArgs,
    @Args('filter', { nullable: true }) filter?: AttributeFilterInput,
  ) {
    return this.attributeService.findAll(pagination, filter);
  }

  @Query(() => Attribute, { name: 'attribute' })
  attribute(@Args('id', { type: () => ID }) id: string) {
    return this.attributeService.findOne(id);
  }

  @Mutation(() => Attribute, { name: 'createAttribute' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  createAttribute(@Args('input') input: CreateAttributeInput) {
    return this.attributeService.create(input);
  }

  @Mutation(() => Attribute, { name: 'updateAttribute' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateAttribute(@Args('input') input: UpdateAttributeInput) {
    return this.attributeService.update(input);
  }

  @Mutation(() => Boolean, { name: 'deleteAttribute' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  deleteAttribute(@Args('id', { type: () => ID }) id: string) {
    return this.attributeService.remove(id);
  }

  @Mutation(() => AttributeValue, { name: 'addAttributeValue' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  addAttributeValue(@Args('input') input: CreateAttributeValueInput) {
    return this.attributeService.addValue(input);
  }

  @Mutation(() => AttributeValue, { name: 'updateAttributeValue' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateAttributeValue(@Args('input') input: UpdateAttributeValueInput) {
    return this.attributeService.updateValue(input);
  }

  @Mutation(() => Boolean, { name: 'deleteAttributeValue' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  deleteAttributeValue(@Args('id', { type: () => ID }) id: string) {
    return this.attributeService.removeValue(id);
  }
}
