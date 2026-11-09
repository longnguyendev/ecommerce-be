import { JwtService } from '@nestjs/jwt';

import { UserRole } from '@/generated/prisma/client';

import {
  authenticateWsConnection,
  WS_CLOSE_TOKEN_EXPIRED,
  wsRequest,
  type WsConnectionContext,
} from './ws-auth';

describe('authenticateWsConnection', () => {
  const jwt = new JwtService({ secret: 'test-secret' });

  function ctx(authorization?: unknown) {
    const socket = { close: jest.fn(), once: jest.fn() };
    const context: WsConnectionContext = {
      connectionParams: authorization === undefined ? {} : { authorization },
      extra: { socket },
    };
    return { context, socket };
  }

  const token = (role: UserRole, expiresIn = 15 * 60) =>
    jwt.signAsync({ sub: 'u1', email: 'a@example.com', role }, { expiresIn });

  afterEach(() => jest.useRealTimers());

  it.each([
    ['không có connectionParams', undefined],
    ['authorization không phải string', 123],
    ['sai scheme', 'Basic abc'],
    ['token rác', 'Bearer not-a-jwt'],
  ])('từ chối khi %s', async (_label, authorization) => {
    const { context } = ctx(authorization);

    await expect(authenticateWsConnection(jwt, context)).resolves.toBe(false);
    expect(context.extra.user).toBeUndefined();
  });

  it('từ chối token ký bằng secret khác', async () => {
    const forged = await new JwtService({ secret: 'other' }).signAsync({
      sub: 'x',
      email: 'x',
      role: UserRole.ADMIN,
    });
    const { context } = ctx(`Bearer ${forged}`);

    await expect(authenticateWsConnection(jwt, context)).resolves.toBe(false);
  });

  it('từ chối token đã hết hạn', async () => {
    const { context } = ctx(`Bearer ${await token(UserRole.ADMIN, -10)}`);

    await expect(authenticateWsConnection(jwt, context)).resolves.toBe(false);
  });

  it('từ chối STAFF (đơn hàng chỉ dành cho ADMIN)', async () => {
    const { context } = ctx(`Bearer ${await token(UserRole.STAFF)}`);

    await expect(authenticateWsConnection(jwt, context)).resolves.toBe(false);
  });

  it('nhận ADMIN, gắn user và đóng socket đúng lúc token hết hạn', async () => {
    const access = await token(UserRole.ADMIN, 60);
    jest.useFakeTimers();
    const { context, socket } = ctx(`Bearer ${access}`);

    await expect(authenticateWsConnection(jwt, context)).resolves.toBe(true);
    expect(context.extra.user).toMatchObject({
      sub: 'u1',
      role: UserRole.ADMIN,
    });

    jest.advanceTimersByTime(55_000);
    expect(socket.close).not.toHaveBeenCalled();
    jest.advanceTimersByTime(10_000);
    expect(socket.close).toHaveBeenCalledWith(
      WS_CLOSE_TOKEN_EXPIRED,
      'Token expired',
    );
  });

  it('huỷ hẹn giờ khi socket đã đóng trước', async () => {
    const access = await token(UserRole.ADMIN, 60);
    jest.useFakeTimers();
    const { context, socket } = ctx(`Bearer ${access}`);
    await authenticateWsConnection(jwt, context);

    const onClose = socket.once.mock.calls[0][1] as () => void;
    onClose();
    jest.advanceTimersByTime(120_000);

    expect(socket.close).not.toHaveBeenCalled();
  });

  it('wsRequest dựng req để guard HTTP dùng lại được', () => {
    const { context } = ctx('Bearer abc');
    context.extra.user = { sub: 'u1', email: 'a', role: UserRole.ADMIN };

    expect(wsRequest(context)).toEqual({
      headers: { authorization: 'Bearer abc' },
      user: context.extra.user,
    });
  });

  it('close code hết hạn không nằm trong nhóm graphql-ws coi là lỗi chết (client tự kết nối lại)', () => {
    // graphql-ws client: 4400, 4401, 4406, 4409, 4429, 4500 và 1000-1999 (trừ vài mã) là fatal.
    expect(WS_CLOSE_TOKEN_EXPIRED).toBeGreaterThanOrEqual(4000);
    expect(WS_CLOSE_TOKEN_EXPIRED).toBeLessThan(4400);
  });
});
