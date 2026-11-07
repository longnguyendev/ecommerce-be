import { HttpStatus, Injectable } from '@nestjs/common';

import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';
import { PaginationArgs } from '@/common/pagination';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

import { CreateCustomerAddressInput } from './dto/create-customer-address.input';
import { CreateCustomerInput } from './dto/create-customer.input';
import { CustomerFilterInput } from './dto/customer-filter.input';
import { UpdateCustomerAddressInput } from './dto/update-customer-address.input';
import { UpdateCustomerInput } from './dto/update-customer.input';

const customerInclude = {
  addresses: { orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] },
} satisfies Prisma.CustomerInclude;

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    pagination: PaginationArgs = {},
    filter: CustomerFilterInput = {},
  ) {
    const take = Math.min(pagination.take ?? 20, 100);
    const skip = pagination.skip ?? 0;

    const where: Prisma.CustomerWhereInput = filter.search
      ? {
          OR: [
            { fullName: { contains: filter.search, mode: 'insensitive' } },
            { email: { contains: filter.search, mode: 'insensitive' } },
            { phone: { contains: filter.search } },
          ],
        }
      : {};

    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        take: take + 1,
        skip,
        orderBy: { createdAt: 'desc' },
        include: customerInclude,
      }),
      this.prisma.customer.count({ where }),
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
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: customerInclude,
    });

    if (!customer) {
      throw this.notFound();
    }

    return customer;
  }

  async create(input: CreateCustomerInput) {
    return this.prisma.customer.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
      },
      include: customerInclude,
    });
  }

  async update(input: UpdateCustomerInput) {
    const { id, ...changes } = input;

    await this.findOne(id);

    return this.prisma.customer.update({
      where: { id },
      data: {
        fullName: changes.fullName,
        email: changes.email,
        phone: changes.phone,
      },
      include: customerInclude,
    });
  }

  async remove(id: string): Promise<boolean> {
    await this.findOne(id);
    await this.prisma.customer.delete({ where: { id } });

    return true;
  }

  async addAddress(input: CreateCustomerAddressInput) {
    await this.findOne(input.customerId);

    return this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId: input.customerId },
          data: { isDefault: false },
        });
      }

      return tx.customerAddress.create({
        data: {
          ...input,
          isDefault: input.isDefault ?? false,
        },
      });
    });
  }

  async updateAddress(input: UpdateCustomerAddressInput) {
    const { id, ...changes } = input;
    const address = await this.findAddress(id);

    return this.prisma.$transaction(async (tx) => {
      if (changes.isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId: address.customerId },
          data: { isDefault: false },
        });
      }

      return tx.customerAddress.update({
        where: { id },
        data: {
          fullName: changes.fullName,
          phone: changes.phone,
          address: changes.address,
          ward: changes.ward,
          district: changes.district,
          province: changes.province,
          isDefault: changes.isDefault,
        },
      });
    });
  }

  async removeAddress(id: string): Promise<boolean> {
    await this.findAddress(id);
    await this.prisma.customerAddress.delete({ where: { id } });

    return true;
  }

  async setDefaultAddress(customerId: string, addressId: string) {
    const address = await this.findAddress(addressId);

    if (address.customerId !== customerId) {
      throw this.addressNotFound();
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.customerAddress.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });

      return tx.customerAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
      });
    });
  }

  private async findAddress(id: string) {
    const address = await this.prisma.customerAddress.findUnique({
      where: { id },
    });

    if (!address) {
      throw this.addressNotFound();
    }

    return address;
  }

  private notFound(): AppException {
    return new AppException(
      'NOT_FOUND',
      I18N_KEYS.ERRORS.SYSTEM.NOT_FOUND,
      HttpStatus.NOT_FOUND,
      { entity: 'Customer' },
    );
  }

  private addressNotFound(): AppException {
    return new AppException(
      'NOT_FOUND',
      I18N_KEYS.ERRORS.BUSINESS.CUSTOMER.ADDRESS_NOT_FOUND,
      HttpStatus.NOT_FOUND,
    );
  }
}
