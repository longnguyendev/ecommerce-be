import { HttpStatus, Injectable } from '@nestjs/common';

import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';
import { PaginationArgs } from '@/common/pagination';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

import { CreateProductInput } from './dto/create-product.input';
import { ProductFilterInput } from './dto/product-filter.input';
import { UpdateProductInput } from './dto/update-product.input';

const variantInclude = {
  attributes: { include: { attribute: true, attributeValue: true } },
  images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
} satisfies Prisma.ProductVariantInclude;

const productInclude = {
  category: true,
  collections: {
    include: { collection: true },
    orderBy: { collection: { sortOrder: 'asc' } },
  },
  images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
  variants: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: variantInclude,
  },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/** Prisma trả về bảng nối (ProductCollection); GraphQL chỉ cần danh sách Collection. */
function toProduct(row: ProductRow) {
  return { ...row, collections: row.collections.map((c) => c.collection) };
}

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    pagination: PaginationArgs = {},
    filter: ProductFilterInput = {},
  ) {
    const take = Math.min(pagination.take ?? 20, 100);
    const skip = pagination.skip ?? 0;

    const where: Prisma.ProductWhereInput = {
      ...(filter.includeDeleted ? {} : { deletedAt: null }),
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
      ...(filter.collectionSlug
        ? {
            collections: {
              some: { collection: { slug: filter.collectionSlug } },
            },
          }
        : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search
        ? {
            OR: [
              { name: { contains: filter.search, mode: 'insensitive' } },
              { slug: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        take: take + 1,
        skip,
        orderBy: { createdAt: 'desc' },
        include: productInclude,
      }),
      this.prisma.product.count({ where }),
    ]);

    const hasNextPage = rows.length > take;
    const nodes = (hasNextPage ? rows.slice(0, take) : rows).map(toProduct);

    return {
      edges: nodes.map((node) => ({ cursor: node.id, node })),
      nodes,
      totalCount,
      hasNextPage,
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: productInclude,
    });

    if (!product) {
      throw this.notFound();
    }

    return toProduct(product);
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, deletedAt: null },
      include: productInclude,
    });

    if (!product) {
      throw this.notFound();
    }

    return toProduct(product);
  }

  async create(input: CreateProductInput) {
    await this.assertCategory(input.categoryId);

    const created = await this.prisma.product.create({
      data: {
        categoryId: input.categoryId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        thumbnail: input.thumbnail,
        status: input.status,
        ...(input.collectionIds
          ? {
              collections: {
                create: input.collectionIds.map((collectionId) => ({
                  collectionId,
                })),
              },
            }
          : {}),
      },
      include: productInclude,
    });

    return toProduct(created);
  }

  async update(input: UpdateProductInput) {
    const { id, ...changes } = input;

    await this.findOne(id);

    if (changes.categoryId) {
      await this.assertCategory(changes.categoryId);
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        categoryId: changes.categoryId,
        name: changes.name,
        slug: changes.slug,
        description: changes.description,
        thumbnail: changes.thumbnail,
        status: changes.status,
        ...(changes.collectionIds
          ? {
              collections: {
                deleteMany: {},
                create: changes.collectionIds.map((collectionId) => ({
                  collectionId,
                })),
              },
            }
          : {}),
      },
      include: productInclude,
    });

    return toProduct(updated);
  }

  async remove(id: string): Promise<boolean> {
    const product = await this.prisma.product.findUnique({ where: { id } });

    if (!product || product.deletedAt) {
      throw this.notFound();
    }

    const deletedAt = new Date();

    await this.prisma.$transaction([
      this.prisma.productVariant.updateMany({
        where: { productId: id, deletedAt: null },
        data: { deletedAt },
      }),
      this.prisma.product.update({
        where: { id },
        data: { deletedAt },
      }),
    ]);

    return true;
  }

  private async assertCategory(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new AppException(
        'BAD_USER_INPUT',
        I18N_KEYS.ERRORS.SYSTEM.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
        { field: 'categoryId', entity: 'Category' },
      );
    }
  }

  private notFound(): AppException {
    return new AppException(
      'NOT_FOUND',
      I18N_KEYS.ERRORS.SYSTEM.NOT_FOUND,
      HttpStatus.NOT_FOUND,
      { entity: 'Product' },
    );
  }
}
