import { JwtService } from '@nestjs/jwt';

import { UserRole } from '@/generated/prisma/client';

import type { AuthenticatedRequest } from '../auth/auth.types';
import { ViewerService } from '../auth/viewer.service';
import type { ProductVariant } from './entities/product-variant.entity';
import { ProductVariantResolver } from './product-variant.resolver';
import type { ProductVariantService } from './product-variant.service';

describe('ProductVariant.costPrice (ẩn giá vốn)', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  const variant = { costPrice: 80_000 } as ProductVariant;
  let viewer: ViewerService;
  let resolver: ProductVariantResolver;

  beforeEach(() => {
    viewer = new ViewerService(jwt);
    resolver = new ProductVariantResolver({} as ProductVariantService, viewer);
  });

  const req = (authorization?: string): AuthenticatedRequest => ({
    headers: { authorization },
  });
  const tokenFor = (role: UserRole) =>
    jwt.signAsync({ sub: 'u1', email: 'a@example.com', role });

  it('khách không có token nhận null', async () => {
    await expect(resolver.costPrice(variant, req())).resolves.toBeNull();
  });

  it('token sai chữ ký / rác nhận null, không ném lỗi', async () => {
    const forged = await new JwtService({ secret: 'other' }).signAsync({
      sub: 'x',
      email: 'x',
      role: UserRole.ADMIN,
    });

    await expect(
      resolver.costPrice(variant, req(`Bearer ${forged}`)),
    ).resolves.toBeNull();
    await expect(
      resolver.costPrice(variant, req('Bearer not-a-jwt')),
    ).resolves.toBeNull();
    await expect(
      resolver.costPrice(
        variant,
        req(`Basic ${await tokenFor(UserRole.ADMIN)}`),
      ),
    ).resolves.toBeNull();
  });

  it('STAFF nhận null', async () => {
    const token = await tokenFor(UserRole.STAFF);

    await expect(
      resolver.costPrice(variant, req(`Bearer ${token}`)),
    ).resolves.toBeNull();
  });

  it('ADMIN nhận giá vốn', async () => {
    const token = await tokenFor(UserRole.ADMIN);

    await expect(
      resolver.costPrice(variant, req(`Bearer ${token}`)),
    ).resolves.toBe(80_000);
  });

  it('chỉ verify token một lần cho mỗi request dù resolve nhiều biến thể', async () => {
    const token = await tokenFor(UserRole.ADMIN);
    const spy = jest.spyOn(jwt, 'verifyAsync');
    const request = req(`Bearer ${token}`);

    await Promise.all(
      Array.from({ length: 20 }, () => resolver.costPrice(variant, request)),
    );

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
