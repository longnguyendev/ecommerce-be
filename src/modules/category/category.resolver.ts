import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Paginated, PaginationArgs } from '@/common/pagination';
import { UserRole } from '@/generated/prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CategoryService } from './category.service';
import { CategoryFilterInput } from './dto/category-filter.input';
import { CreateCategoryInput } from './dto/create-category.input';
import { UpdateCategoryInput } from './dto/update-category.input';
import { Category } from './entities/category.entity';

const PaginatedCategory = Paginated(Category);

@Resolver(() => Category)
export class CategoryResolver {
  constructor(private readonly categoryService: CategoryService) {}

  @Query(() => PaginatedCategory, { name: 'categories' })
  categories(
    @Args('pagination', { nullable: true }) pagination?: PaginationArgs,
    @Args('filter', { nullable: true }) filter?: CategoryFilterInput,
  ) {
    return this.categoryService.findAll(pagination, filter);
  }

  @Query(() => Category, { name: 'category' })
  category(@Args('id', { type: () => ID }) id: string) {
    return this.categoryService.findOne(id);
  }

  @Mutation(() => Category, { name: 'createCategory' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  createCategory(@Args('input') input: CreateCategoryInput) {
    return this.categoryService.create(input);
  }

  @Mutation(() => Category, { name: 'updateCategory' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateCategory(@Args('input') input: UpdateCategoryInput) {
    return this.categoryService.update(input);
  }

  @Mutation(() => Boolean, { name: 'deleteCategory' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  deleteCategory(@Args('id', { type: () => ID }) id: string) {
    return this.categoryService.remove(id);
  }
}
