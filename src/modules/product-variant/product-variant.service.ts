import { HttpStatus, Injectable } from '@nestjs/common';

import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';
import { PaginationArgs } from '@/common/pagination';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

import { CreateProductVariantInput } from './dto/create-product-variant.input';
import { ProductVariantFilterInput } from './dto/product-variant-filter.input';
import { SyncProductVariantsInput } from './dto/sync-product-variants.input';
import { UpdateProductVariantInput } from './dto/update-product-variant.input';

const variantInclude = {
  attributes: { include: { attribute: true, attributeValue: true } },
  images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
} satisfies Prisma.ProductVariantInclude;

interface AttributeLink {
  attributeId: string;
  attributeValueId: string;
}

function comboKey(links: AttributeLink[]): string {
  return links
    .map((l) => `${l.attributeId}:${l.attributeValueId}`)
    .sort()
    .join('|');
}

@Injectable()
export class ProductVariantService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    pagination: PaginationArgs = {},
    filter: ProductVariantFilterInput = {},
  ) {
    const take = Math.min(pagination.take ?? 20, 100);
    const skip = pagination.skip ?? 0;

    const where: Prisma.ProductVariantWhereInput = {
      ...(filter.includeDeleted ? {} : { deletedAt: null }),
      ...(filter.productId ? { productId: filter.productId } : {}),
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
      ...(filter.sku
        ? { sku: { contains: filter.sku, mode: 'insensitive' } }
        : {}),
    };

    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.productVariant.findMany({
        where,
        take: take + 1,
        skip,
        orderBy: { createdAt: 'desc' },
        include: variantInclude,
      }),
      this.prisma.productVariant.count({ where }),
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
    const variant = await this.prisma.productVariant.findFirst({
      where: { id, deletedAt: null },
      include: variantInclude,
    });

    if (!variant) {
      throw this.notFound();
    }

    return variant;
  }

  async create(input: CreateProductVariantInput) {
    await this.assertProduct(input.productId);
    const links = await this.resolveAttributeLinks(
      input.attributeValueIds ?? [],
    );

    return this.prisma.productVariant.create({
      data: {
        productId: input.productId,
        sku: input.sku,
        price: input.price,
        costPrice: input.costPrice ?? 0,
        compareAtPrice: input.compareAtPrice,
        stockQuantity: input.stockQuantity ?? 0,
        isActive: input.isActive ?? true,
        attributes: links.length > 0 ? { create: links } : undefined,
      },
      include: variantInclude,
    });
  }

  async update(input: UpdateProductVariantInput) {
    const { id, attributeValueIds, ...changes } = input;

    await this.findOne(id);

    if (changes.productId) {
      await this.assertProduct(changes.productId);
    }

    const links =
      attributeValueIds !== undefined
        ? await this.resolveAttributeLinks(attributeValueIds)
        : null;

    return this.prisma.$transaction(async (tx) => {
      await tx.productVariant.update({
        where: { id },
        data: {
          productId: changes.productId,
          sku: changes.sku,
          price: changes.price,
          costPrice: changes.costPrice,
          compareAtPrice: changes.compareAtPrice,
          stockQuantity: changes.stockQuantity,
          isActive: changes.isActive,
        },
      });

      if (links) {
        await tx.variantAttributeValue.deleteMany({ where: { variantId: id } });

        if (links.length > 0) {
          await tx.variantAttributeValue.createMany({
            data: links.map((link) => ({ variantId: id, ...link })),
          });
        }
      }

      return tx.productVariant.findUniqueOrThrow({
        where: { id },
        include: variantInclude,
      });
    });
  }

  /**
   * Đồng bộ toàn bộ biến thể của sản phẩm trong 1 transaction.
   * - Khớp theo tổ hợp thuộc tính: có sẵn -> update, mới -> create, vắng mặt -> soft-delete.
   * - AttributeValue chưa có sẽ được tạo tự động.
   */
  async sync(input: SyncProductVariantsInput) {
    await this.assertProduct(input.productId);

    const skus = input.variants.map((v) => v.sku.trim());
    if (new Set(skus).size !== skus.length) {
      throw new AppException(
        'BAD_USER_INPUT',
        I18N_KEYS.ERRORS.BUSINESS.VARIANT.ATTRIBUTE_MISMATCH,
        HttpStatus.BAD_REQUEST,
        { reason: 'duplicate sku' },
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // 1) Resolve (upsert) attribute values -> key tổ hợp
      const valueCache = new Map<string, string>();
      const resolveValue = async (attributeId: string, value: string) => {
        const cacheKey = `${attributeId}:${value}`;
        const cached = valueCache.get(cacheKey);
        if (cached) return cached;
        const row = await tx.attributeValue.upsert({
          where: { attributeId_value: { attributeId, value } },
          update: {},
          create: { attributeId, value },
          select: { id: true },
        });
        valueCache.set(cacheKey, row.id);
        return row.id;
      };

      const wanted: {
        key: string;
        links: AttributeLink[];
        data: (typeof input.variants)[number];
      }[] = [];

      for (const variant of input.variants) {
        const links: AttributeLink[] = [];
        const seenAttr = new Set<string>();
        for (const opt of variant.options) {
          if (seenAttr.has(opt.attributeId)) {
            throw new AppException(
              'BAD_USER_INPUT',
              I18N_KEYS.ERRORS.BUSINESS.VARIANT.DUPLICATE_ATTRIBUTE,
              HttpStatus.BAD_REQUEST,
              { attributeId: opt.attributeId },
            );
          }
          seenAttr.add(opt.attributeId);
          links.push({
            attributeId: opt.attributeId,
            attributeValueId: await resolveValue(
              opt.attributeId,
              opt.value.trim(),
            ),
          });
        }
        const key = comboKey(links);
        if (wanted.some((w) => w.key === key)) {
          throw new AppException(
            'BAD_USER_INPUT',
            I18N_KEYS.ERRORS.BUSINESS.VARIANT.DUPLICATE_ATTRIBUTE,
            HttpStatus.BAD_REQUEST,
            { reason: 'duplicate combination' },
          );
        }
        wanted.push({ key, links, data: variant });
      }

      // 2) Biến thể hiện có
      const existing = await tx.productVariant.findMany({
        where: { productId: input.productId, deletedAt: null },
        include: { attributes: true },
      });
      const existingByKey = new Map(
        existing.map((v) => [comboKey(v.attributes), v]),
      );
      const wantedKeys = new Set(wanted.map((w) => w.key));

      // 3) Soft-delete biến thể không còn; đổi sku để không chặn unique
      for (const [key, variant] of existingByKey) {
        if (!wantedKeys.has(key)) {
          await tx.productVariant.update({
            where: { id: variant.id },
            data: {
              deletedAt: new Date(),
              sku: `${variant.sku}__del_${Date.now()}`,
            },
          });
        }
      }

      // 4) Update / create
      for (const item of wanted) {
        const { data } = item;
        const fields = {
          sku: data.sku.trim(),
          price: data.price,
          costPrice: data.costPrice,
          compareAtPrice: data.compareAtPrice ?? null,
          stockQuantity: data.stockQuantity ?? 0,
          isActive: data.isActive ?? true,
        };
        const found = existingByKey.get(item.key);
        let variantId: string;
        if (found) {
          await tx.productVariant.update({
            where: { id: found.id },
            data: fields,
          });
          variantId = found.id;
        } else {
          const created = await tx.productVariant.create({
            data: {
              productId: input.productId,
              ...fields,
              costPrice: data.costPrice ?? 0,
              attributes:
                item.links.length > 0 ? { create: item.links } : undefined,
            },
            select: { id: true },
          });
          variantId = created.id;
        }

        await this.syncVariantImage(
          tx,
          input.productId,
          variantId,
          data.imageUrl,
        );
      }
    });

    return this.prisma.productVariant.findMany({
      where: { productId: input.productId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: variantInclude,
    });
  }

  /** Ảnh đại diện biến thể = ảnh đầu tiên có variantId; không đụng tới ảnh đại diện sản phẩm. */
  private async syncVariantImage(
    tx: Prisma.TransactionClient,
    productId: string,
    variantId: string,
    imageUrl: string | null | undefined,
  ): Promise<void> {
    if (imageUrl === undefined) return;

    const current = await tx.productImage.findFirst({
      where: { variantId },
      orderBy: [
        { isPrimary: 'desc' },
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
      select: { id: true, url: true },
    });
    const url = imageUrl?.trim() ?? '';

    if (!url) {
      if (current) await tx.productImage.deleteMany({ where: { variantId } });
      return;
    }
    if (!current) {
      await tx.productImage.create({
        data: { productId, variantId, url, sortOrder: 0, isPrimary: false },
      });
    } else if (current.url !== url) {
      await tx.productImage.update({
        where: { id: current.id },
        data: { url },
      });
    }
  }

  async remove(id: string): Promise<boolean> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
    });

    if (!variant || variant.deletedAt) {
      throw this.notFound();
    }

    await this.prisma.productVariant.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return true;
  }

  private async assertProduct(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, deletedAt: true },
    });

    if (!product || product.deletedAt) {
      throw new AppException(
        'BAD_USER_INPUT',
        I18N_KEYS.ERRORS.BUSINESS.VARIANT.PRODUCT_INACTIVE,
        HttpStatus.BAD_REQUEST,
        { productId },
      );
    }
  }

  private async resolveAttributeLinks(
    attributeValueIds: string[],
  ): Promise<AttributeLink[]> {
    const uniqueIds = [...new Set(attributeValueIds)];

    if (uniqueIds.length === 0) {
      return [];
    }

    const values = await this.prisma.attributeValue.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, attributeId: true },
    });

    if (values.length !== uniqueIds.length) {
      const foundIds = new Set(values.map((value) => value.id));

      throw new AppException(
        'BAD_USER_INPUT',
        I18N_KEYS.ERRORS.BUSINESS.VARIANT.ATTRIBUTE_MISMATCH,
        HttpStatus.BAD_REQUEST,
        {
          missing: uniqueIds.filter((id) => !foundIds.has(id)),
        },
      );
    }

    const byAttribute = new Map<string, string>();

    for (const value of values) {
      if (byAttribute.has(value.attributeId)) {
        throw new AppException(
          'BAD_USER_INPUT',
          I18N_KEYS.ERRORS.BUSINESS.VARIANT.DUPLICATE_ATTRIBUTE,
          HttpStatus.BAD_REQUEST,
          { attributeId: value.attributeId },
        );
      }

      byAttribute.set(value.attributeId, value.id);
    }

    return values.map((value) => ({
      attributeId: value.attributeId,
      attributeValueId: value.id,
    }));
  }

  private notFound(): AppException {
    return new AppException(
      'NOT_FOUND',
      I18N_KEYS.ERRORS.SYSTEM.NOT_FOUND,
      HttpStatus.NOT_FOUND,
      { entity: 'ProductVariant' },
    );
  }
}
