import { HttpStatus, Injectable } from '@nestjs/common';

import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';
import { PaginationArgs } from '@/common/pagination';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

import { CategoryFilterInput } from './dto/category-filter.input';
import { CreateCategoryInput } from './dto/create-category.input';
import { UpdateCategoryInput } from './dto/update-category.input';

const categoryInclude = {
  parent: true,
  children: { orderBy: { name: 'asc' } },
} satisfies Prisma.CategoryInclude;

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    pagination: PaginationArgs = {},
    filter: CategoryFilterInput = {},
  ) {
    const take = Math.min(pagination.take ?? 20, 100);
    const skip = pagination.skip ?? 0;

    const where: Prisma.CategoryWhereInput = {
      ...(filter.parentId ? { parentId: filter.parentId } : {}),
      ...(filter.onlyRoot ? { parentId: null } : {}),
      ...(filter.search
        ? { name: { contains: filter.search, mode: 'insensitive' } }
        : {}),
    };

    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        take: take + 1,
        skip,
        orderBy: { name: 'asc' },
        include: categoryInclude,
      }),
      this.prisma.category.count({ where }),
    ]);

    const hasNextPage = rows.length > take;
    const nodes = hasNextPage ? rows.slice(0, take) : rows;

    return {
      edges: nodes.map((node) => ({ cursor: node.id, node })),
      nodes,
      totalCount,
      hasNextPage,
    };
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: categoryInclude,
    });

    if (!category) {
      throw this.notFound();
    }

    return category;
  }

  async create(input: CreateCategoryInput) {
    await this.assertValidParent(null, input.parentId);

    return this.prisma.category.create({
      data: {
        name: input.name,
        slug: input.slug,
        parentId: input.parentId ?? null,
      },
      include: categoryInclude,
    });
  }

  async update(input: UpdateCategoryInput) {
    const { id, ...changes } = input;

    await this.findOne(id);

    if (changes.parentId !== undefined) {
      await this.assertValidParent(id, changes.parentId);
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: changes.name,
        slug: changes.slug,
        parentId: changes.parentId,
      },
      include: categoryInclude,
    });
  }

  async remove(id: string): Promise<boolean> {
    await this.findOne(id);

    const [childCount, productCount] = await Promise.all([
      this.prisma.category.count({ where: { parentId: id } }),
      this.prisma.product.count({ where: { categoryId: id } }),
    ]);

    if (childCount > 0 || productCount > 0) {
      throw new AppException(
        'CONFLICT',
        I18N_KEYS.ERRORS.SYSTEM.CONFLICT,
        HttpStatus.CONFLICT,
        { children: childCount, products: productCount },
      );
    }

    await this.prisma.category.delete({ where: { id } });

    return true;
  }

  private notFound(): AppException {
    return new AppException(
      'NOT_FOUND',
      I18N_KEYS.ERRORS.SYSTEM.NOT_FOUND,
      HttpStatus.NOT_FOUND,
      { entity: 'Category' },
    );
  }

  private async assertValidParent(
    categoryId: string | null,
    parentId: string | null | undefined,
  ): Promise<void> {
    if (!parentId) {
      return;
    }

    if (parentId === categoryId) {
      throw this.invalidParent();
    }

    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true },
    });

    if (!parent) {
      throw this.invalidParent();
    }

    // Walk up the tree to reject cycles.
    let ancestorId = parent.parentId;
    while (ancestorId) {
      if (ancestorId === categoryId) {
        throw this.invalidParent();
      }

      const ancestor = await this.prisma.category.findUnique({
        where: { id: ancestorId },
        select: { parentId: true },
      });
      ancestorId = ancestor?.parentId ?? null;
    }
  }

  private invalidParent(): AppException {
    return new AppException(
      'BAD_USER_INPUT',
      I18N_KEYS.ERRORS.BUSINESS.CATEGORY.INVALID_PARENT,
      HttpStatus.BAD_REQUEST,
    );
  }
}
