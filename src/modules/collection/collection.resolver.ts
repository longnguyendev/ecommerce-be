import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { UserRole } from '@/generated/prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CollectionService } from './collection.service';
import { CreateCollectionInput } from './dto/create-collection.input';
import { UpdateCollectionInput } from './dto/update-collection.input';
import { Collection } from './entities/collection.entity';

@Resolver(() => Collection)
export class CollectionResolver {
  constructor(private readonly collectionService: CollectionService) {}

  @Query(() => [Collection], { name: 'collections' })
  collections() {
    return this.collectionService.findAll();
  }

  @Mutation(() => Collection, { name: 'createCollection' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  createCollection(@Args('input') input: CreateCollectionInput) {
    return this.collectionService.create(input);
  }

  @Mutation(() => Collection, { name: 'updateCollection' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateCollection(@Args('input') input: UpdateCollectionInput) {
    return this.collectionService.update(input);
  }

  @Mutation(() => Boolean, { name: 'deleteCollection' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  deleteCollection(@Args('id', { type: () => ID }) id: string) {
    return this.collectionService.remove(id);
  }
}
