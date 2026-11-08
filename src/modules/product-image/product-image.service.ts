import { HttpStatus, Injectable } from '@nestjs/common';

import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';
import { PaginationArgs } from '@/common/pagination';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

import { CreateProductImageInput } from './dto/create-product-image.input';
import { ProductImageFilterInput } from './dto/product-image-filter.input';
import { ReorderProductImagesInput } from './dto/reorder-product-images.input';
import { UpdateProductImageInput } from './dto/update-product-image.input';

@Injectable()
export class ProductImageService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    pagination: PaginationArgs = {},
    filter: ProductImageFilterInput = {},
  ) {
    const take = Math.min(pagination.take ?? 20, 100);
    const skip = pagination.skip ?? 0;

    const where: Prisma.ProductImageWhereInput = {
      ...(filter.productId ? { productId: filter.productId } : {}),
      ...(filter.attributeValueId
        ? { attributeValueId: filter.attributeValueId }
        : {}),
    };

    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.productImage.findMany({
        where,
        take: take + 1,
        skip,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.productImage.count({ where }),
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
    const image = await this.prisma.productImage.findUnique({ where: { id } });

    if (!image) {
      throw this.notFound();
    }

    return image;
  }

  async create(input: CreateProductImageInput) {
    await this.assertProduct(input.productId);

    if (input.attributeValueId) {
      await this.assertColorValue(input.attributeValueId);
    }

    return this.prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.productImage.updateMany({
          where: { productId: input.productId, isPrimary: true },
          data: { isPrimary: false },
        });
        await tx.product.update({
          where: { id: input.productId },
          data: { thumbnail: input.url },
        });
      }

      return tx.productImage.create({
        data: {
          productId: input.productId,
          attributeValueId: input.attributeValueId ?? null,
          url: input.url,
          alt: input.alt,
          sortOrder: input.sortOrder ?? 0,
          isPrimary: input.isPrimary ?? false,
        },
      });
    });
  }

  async update(input: UpdateProductImageInput) {
    const { id, ...changes } = input;
    const image = await this.findOne(id);
    const product = await this.prisma.product.findUnique({
      where: { id: image.productId },
      select: { thumbnail: true },
    });
    if (changes.attributeValueId) {
      await this.assertColorValue(changes.attributeValueId);
    }
    const nextUrl = changes.url ?? image.url;
    const nextIsPrimary = changes.isPrimary ?? image.isPrimary;

    return this.prisma.$transaction(async (tx) => {
      if (nextIsPrimary) {
        await tx.productImage.updateMany({
          where: {
            productId: image.productId,
            id: { not: id },
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
        await tx.product.update({
          where: { id: image.productId },
          data: { thumbnail: nextUrl },
        });
      } else if (image.isPrimary && product?.thumbnail === image.url) {
        await tx.product.update({
          where: { id: image.productId },
          data: { thumbnail: null },
        });
      }

      return tx.productImage.update({
        where: { id },
        data: {
          url: changes.url,
          alt: changes.alt,
          sortOrder: changes.sortOrder,
          isPrimary: changes.isPrimary,
          attributeValueId: changes.attributeValueId,
        },
      });
    });
  }

  async remove(id: string): Promise<boolean> {
    const image = await this.findOne(id);
    const product = await this.prisma.product.findUnique({
      where: { id: image.productId },
      select: { thumbnail: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.productImage.delete({ where: { id } });

      if (image.isPrimary && product?.thumbnail === image.url) {
        await tx.product.update({
          where: { id: image.productId },
          data: { thumbnail: null },
        });
      }
    });

    return true;
  }

  /**
   * Sắp xếp lại ảnh: sortOrder theo vị trí trong mảng, ảnh đầu tiên là ảnh đại diện
   * (isPrimary + Product.thumbnail).
   */
  async reorder(input: ReorderProductImagesInput) {
    await this.assertProduct(input.productId);

    const images = await this.prisma.productImage.findMany({
      where: { productId: input.productId, id: { in: input.imageIds } },
      select: { id: true, url: true },
    });

    if (images.length !== input.imageIds.length) {
      throw new AppException(
        'BAD_USER_INPUT',
        I18N_KEYS.ERRORS.SYSTEM.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
        { field: 'imageIds', entity: 'ProductImage' },
      );
    }

    const urlById = new Map(images.map((image) => [image.id, image.url]));

    return this.prisma.$transaction(async (tx) => {
      await tx.productImage.updateMany({
        where: { productId: input.productId, isPrimary: true },
        data: { isPrimary: false },
      });

      for (const [index, id] of input.imageIds.entries()) {
        await tx.productImage.update({
          where: { id },
          data: { sortOrder: index, isPrimary: index === 0 },
        });
      }

      await tx.product.update({
        where: { id: input.productId },
        data: { thumbnail: urlById.get(input.imageIds[0]) },
      });

      return tx.productImage.findMany({
        where: { productId: input.productId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    });
  }

  async setPrimary(id: string) {
    const image = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      await tx.productImage.updateMany({
        where: { productId: image.productId, isPrimary: true },
        data: { isPrimary: false },
      });

      const updated = await tx.productImage.update({
        where: { id },
        data: { isPrimary: true },
      });

      await tx.product.update({
        where: { id: image.productId },
        data: { thumbnail: image.url },
      });

      return updated;
    });
  }

  private async assertProduct(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, deletedAt: true },
    });

    if (!product || product.deletedAt) {
      throw new AppException(
        'BAD_USER_INPUT',
        I18N_KEYS.ERRORS.SYSTEM.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
        { field: 'productId', entity: 'Product' },
      );
    }
  }

  private async assertColorValue(attributeValueId: string): Promise<void> {
    const value = await this.prisma.attributeValue.findUnique({
      where: { id: attributeValueId },
      select: { id: true },
    });

    if (!value) {
      throw new AppException(
        'BAD_USER_INPUT',
        I18N_KEYS.ERRORS.SYSTEM.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
        { field: 'attributeValueId', entity: 'AttributeValue' },
      );
    }
  }

  private notFound(): AppException {
    return new AppException(
      'NOT_FOUND',
      I18N_KEYS.ERRORS.SYSTEM.NOT_FOUND,
      HttpStatus.NOT_FOUND,
      { entity: 'ProductImage' },
    );
  }
}
