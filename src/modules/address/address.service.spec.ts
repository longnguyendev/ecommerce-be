import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';
import type { PrismaService } from '@/prisma/prisma.service';

import { AddressService } from './address.service';

const PROVINCES = [
  { code: '79', name: 'Thành phố Hồ Chí Minh', type: 'thành phố trung ương' },
  { code: '01', name: 'Thành phố Hà Nội', type: 'thành phố trung ương' },
  { code: '96', name: 'Tỉnh Cà Mau', type: 'tỉnh' },
];

const WARDS = [
  {
    code: '26743',
    name: 'Phường Bến Thành',
    type: 'phường',
    provinceCode: '79',
  },
  { code: '26734', name: 'Phường Sài Gòn', type: 'phường', provinceCode: '79' },
  { code: '26740', name: 'Phường Bàn Cờ', type: 'phường', provinceCode: '79' },
  { code: '00004', name: 'Phường Ba Đình', type: 'phường', provinceCode: '01' },
];

function setup() {
  const prisma = {
    province: { findMany: jest.fn().mockResolvedValue([...PROVINCES]) },
    ward: { findMany: jest.fn().mockResolvedValue([...WARDS]) },
  };
  return {
    prisma,
    service: new AddressService(prisma as unknown as PrismaService),
  };
}

describe('AddressService', () => {
  it('provinces sắp theo tên riêng (bỏ tiền tố Thành phố/Tỉnh)', async () => {
    const { service } = setup();

    const names = (await service.provinces()).map((p) => p.name);

    expect(names).toEqual([
      'Tỉnh Cà Mau',
      'Thành phố Hà Nội',
      'Thành phố Hồ Chí Minh',
    ]);
  });

  it('wards chỉ trả xã của tỉnh, sắp theo tên (dấu tiếng Việt đúng thứ tự)', async () => {
    const { service } = setup();

    const names = (await service.wards('79')).map((w) => w.name);

    expect(names).toEqual([
      'Phường Bàn Cờ',
      'Phường Bến Thành',
      'Phường Sài Gòn',
    ]);
    await expect(service.wards('00')).resolves.toEqual([]);
  });

  it('chỉ nạp danh mục từ DB một lần, kể cả khi gọi đồng thời', async () => {
    const { prisma, service } = setup();

    await Promise.all([
      service.provinces(),
      service.wards('79'),
      service.resolve('79', '26743'),
    ]);
    await service.provinces();

    expect(prisma.province.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.ward.findMany).toHaveBeenCalledTimes(1);
  });

  it('nạp lỗi thì lần sau thử lại, không cache lỗi', async () => {
    const { prisma, service } = setup();
    prisma.province.findMany.mockRejectedValueOnce(new Error('db down'));

    await expect(service.provinces()).rejects.toThrow('db down');
    await expect(service.provinces()).resolves.toHaveLength(3);
    expect(prisma.province.findMany).toHaveBeenCalledTimes(2);
  });

  it('resolve trả tên tỉnh/xã theo mã', async () => {
    const { service } = setup();

    await expect(service.resolve('79', '26743')).resolves.toMatchObject({
      province: { code: '79', name: 'Thành phố Hồ Chí Minh' },
      ward: { code: '26743', name: 'Phường Bến Thành' },
    });
  });

  it.each([
    ['tỉnh không tồn tại', '00', '26743', 'shippingProvinceCode'],
    ['xã không tồn tại', '79', '99999', 'shippingWardCode'],
    ['xã thuộc tỉnh khác', '79', '00004', 'shippingWardCode'],
  ])(
    'resolve %s -> ADDRESS.INVALID chỉ đúng field',
    async (_l, p, w, field) => {
      const { service } = setup();

      const error = await service.resolve(p, w).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).i18nKey).toBe(
        I18N_KEYS.ERRORS.BUSINESS.ADDRESS.INVALID,
      );
      expect((error as AppException).params).toEqual({
        fields: [{ field, rule: 'adminUnit' }],
      });
    },
  );
});
