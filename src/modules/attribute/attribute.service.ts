import { HttpStatus, Injectable } from '@nestjs/common';

import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';
import { PaginationArgs } from '@/common/pagination';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

import { AttributeFilterInput } from './dto/attribute-filter.input';
import { CreateAttributeValueInput } from './dto/create-attribute-value.input';
import { CreateAttributeInput } from './dto/create-attribute.input';
import { UpdateAttributeValueInput } from './dto/update-attribute-value.input';
import { UpdateAttributeInput } from './dto/update-attribute.input';

const attributeInclude = {
  values: { orderBy: { value: 'asc' } },
} satisfies Prisma.AttributeInclude;

@Injectable()
export class AttributeService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    pagination: PaginationArgs = {},
    filter: AttributeFilterInput = {},
  ) {
    const take = Math.min(pagination.take ?? 20, 100);
    const skip = pagination.skip ?? 0;

    const where: Prisma.AttributeWhereInput = filter.search
      ? { name: { contains: filter.search, mode: 'insensitive' } }
      : {};

    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.attribute.findMany({
        where,
        take: take + 1,
        skip,
        orderBy: { name: 'asc' },
        include: attributeInclude,
      }),
      this.prisma.attribute.count({ where }),
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
    const attribute = await this.prisma.attribute.findUnique({
      where: { id },
      include: attributeInclude,
    });

    if (!attribute) {
      throw this.notFound('Attribute');
    }

    return attribute;
  }

  async create(input: CreateAttributeInput) {
    const values = [...new Set(input.values ?? [])];

    return this.prisma.attribute.create({
      data: {
        name: input.name,
        values:
          values.length > 0
            ? { create: values.map((value) => ({ value })) }
            : undefined,
      },
      include: attributeInclude,
    });
  }

  /**
   * Renames the attribute. When `values` is provided, new values are added;
   * existing values are never removed implicitly (variants may reference them).
   */
  async update(input: UpdateAttributeInput) {
    const { id, values, ...changes } = input;

    await this.findOne(id);

    if (values && values.length > 0) {
      const existing = await this.prisma.attributeValue.findMany({
        where: { attributeId: id },
        select: { value: true },
      });
      const existingValues = new Set(existing.map((item) => item.value));
      const missing = [...new Set(values)].filter(
        (value) => !existingValues.has(value),
      );

      if (missing.length > 0) {
        await this.prisma.attributeValue.createMany({
          data: missing.map((value) => ({ attributeId: id, value })),
        });
      }
    }

    return this.prisma.attribute.update({
      where: { id },
      data: { name: changes.name },
      include: attributeInclude,
    });
  }

  async remove(id: string): Promise<boolean> {
    await this.findOne(id);
    await this.prisma.attribute.delete({ where: { id } });

    return true;
  }

  async addValue(input: CreateAttributeValueInput) {
    await this.findOne(input.attributeId);

    return this.prisma.attributeValue.create({ data: input });
  }

  async updateValue(input: UpdateAttributeValueInput) {
    await this.findValue(input.id);

    return this.prisma.attributeValue.update({
      where: { id: input.id },
      data: { value: input.value },
    });
  }

  async removeValue(id: string): Promise<boolean> {
    await this.findValue(id);
    await this.prisma.attributeValue.delete({ where: { id } });

    return true;
  }

  private async findValue(id: string) {
    const value = await this.prisma.attributeValue.findUnique({
      where: { id },
    });

    if (!value) {
      throw this.notFound('AttributeValue');
    }

    return value;
  }

  private notFound(entity: string): AppException {
    return new AppException(
      'NOT_FOUND',
      I18N_KEYS.ERRORS.SYSTEM.NOT_FOUND,
      HttpStatus.NOT_FOUND,
      { entity },
    );
  }
}
