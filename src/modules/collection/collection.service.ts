import { HttpStatus, Injectable } from '@nestjs/common';

import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';
import { PrismaService } from '@/prisma/prisma.service';

import { CreateCollectionInput } from './dto/create-collection.input';
import { UpdateCollectionInput } from './dto/update-collection.input';

@Injectable()
export class CollectionService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.collection.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
    });

    if (!collection) {
      throw this.notFound();
    }

    return collection;
  }

  create(input: CreateCollectionInput) {
    return this.prisma.collection.create({
      data: {
        name: input.name,
        slug: input.slug,
        image: input.image,
        sortOrder: input.sortOrder,
      },
    });
  }

  async update(input: UpdateCollectionInput) {
    const { id, ...changes } = input;

    await this.findOne(id);

    return this.prisma.collection.update({
      where: { id },
      data: {
        name: changes.name,
        slug: changes.slug,
        image: changes.image,
        sortOrder: changes.sortOrder,
      },
    });
  }

  async remove(id: string): Promise<boolean> {
    await this.findOne(id);
    // ProductCollection bị xoá theo (onDelete: Cascade); sản phẩm không bị ảnh hưởng.
    await this.prisma.collection.delete({ where: { id } });

    return true;
  }

  private notFound(): AppException {
    return new AppException(
      'NOT_FOUND',
      I18N_KEYS.ERRORS.SYSTEM.NOT_FOUND,
      HttpStatus.NOT_FOUND,
      { entity: 'Collection' },
    );
  }
}
