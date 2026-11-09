import { HttpStatus, Injectable } from '@nestjs/common';

import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';
import { PrismaService } from '@/prisma/prisma.service';

import type { Province, Ward } from './entities/admin-unit.entity';

const collator = new Intl.Collator('vi');
/** "Thành phố Hồ Chí Minh" -> "Hồ Chí Minh": sắp theo tên riêng, không theo loại. */
const PREFIX = /^(Thành phố|Tỉnh|Phường|Xã|Đặc khu)\s+/;
const byName = (a: { name: string }, b: { name: string }) =>
  collator.compare(a.name.replace(PREFIX, ''), b.name.replace(PREFIX, ''));

export interface ResolvedAddress {
  province: Province;
  ward: Ward;
}

/**
 * Danh mục hành chính là dữ liệu tĩnh (chỉ đổi qua migration) nên nạp một lần
 * vào bộ nhớ: tra cứu không tốn query, cả cho dropdown lẫn kiểm tra lúc checkout.
 */
@Injectable()
export class AddressService {
  private cache?: Promise<{
    provinces: Province[];
    provinceByCode: Map<string, Province>;
    wardsByProvince: Map<string, Ward[]>;
    wardByCode: Map<string, Ward>;
  }>;

  constructor(private readonly prisma: PrismaService) {}

  async provinces(): Promise<Province[]> {
    return (await this.load()).provinces;
  }

  /** Xã/phường của một tỉnh, sắp theo tên; tỉnh không tồn tại -> []. */
  async wards(provinceCode: string): Promise<Ward[]> {
    return (await this.load()).wardsByProvince.get(provinceCode) ?? [];
  }

  /**
   * Kiểm tra cặp mã tỉnh + xã và trả về tên để lưu vào đơn.
   * Sai mã / xã không thuộc tỉnh -> BAD_USER_INPUT kèm field để FE báo đúng ô.
   */
  async resolve(
    provinceCode: string,
    wardCode: string,
  ): Promise<ResolvedAddress> {
    const { provinceByCode, wardByCode } = await this.load();
    const province = provinceByCode.get(provinceCode);

    if (!province) {
      throw this.invalid('shippingProvinceCode');
    }

    const ward = wardByCode.get(wardCode);

    if (!ward || ward.provinceCode !== province.code) {
      throw this.invalid('shippingWardCode');
    }

    return { province, ward };
  }

  private load() {
    this.cache ??= (async () => {
      const [provinces, wards] = await Promise.all([
        this.prisma.province.findMany(),
        this.prisma.ward.findMany(),
      ]);
      provinces.sort(byName);
      wards.sort(byName);

      const wardsByProvince = new Map<string, Ward[]>();
      for (const ward of wards) {
        const list = wardsByProvince.get(ward.provinceCode) ?? [];
        list.push(ward);
        wardsByProvince.set(ward.provinceCode, list);
      }

      return {
        provinces,
        provinceByCode: new Map(provinces.map((p) => [p.code, p])),
        wardsByProvince,
        wardByCode: new Map(wards.map((w) => [w.code, w])),
      };
    })().catch((error: unknown) => {
      // Lỗi DB lúc nạp: lần gọi sau thử lại thay vì cache lỗi vĩnh viễn.
      this.cache = undefined;
      throw error;
    });

    return this.cache;
  }

  private invalid(field: string): AppException {
    return new AppException(
      'BAD_USER_INPUT',
      I18N_KEYS.ERRORS.BUSINESS.ADDRESS.INVALID,
      HttpStatus.BAD_REQUEST,
      { fields: [{ field, rule: 'adminUnit' }] },
    );
  }
}
