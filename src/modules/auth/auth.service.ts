import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import type { AppConfig } from '@/common/config/app.config';
import { I18N_KEYS } from '@/common/constants';
import { AppException } from '@/common/exceptions';
import type { UserRole } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

import type { JwtPayload } from './auth.types';
import { SignInInput } from './dto/sign-in.input';
import { AuthToken } from './entities/auth-token.entity';
import { User } from './entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig>,
  ) {}

  async signIn(input: SignInInput): Promise<AuthToken> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw this.unauthorized();
    }
    if (!user.isActive) {
      throw this.unauthorized();
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthToken> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get('jwt.refreshSecret', { infer: true }),
      });
    } catch {
      throw this.unauthorized();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) throw this.unauthorized();

    return this.issueTokens(user);
  }

  async me(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw this.unauthorized();
    return this.toEntity(user);
  }

  private async issueTokens(user: {
    id: string;
    email: string;
    displayName: string | null;
    role: UserRole;
    isActive: boolean;
  }): Promise<AuthToken> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get('jwt.refreshSecret', { infer: true }),
      expiresIn: this.configService.get('jwt.refreshExpirationTime', {
        infer: true,
      }),
    });

    return {
      accessToken,
      refreshToken,
      user: this.toEntity(user),
    };
  }

  private toEntity(user: {
    id: string;
    email: string;
    displayName: string | null;
    role: UserRole;
    isActive: boolean;
  }): User {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? undefined,
      role: user.role,
      isActive: user.isActive,
    };
  }

  private unauthorized(): AppException {
    return new AppException(
      'UNAUTHENTICATED',
      I18N_KEYS.ERRORS.SYSTEM.UNAUTHORIZED,
      HttpStatus.UNAUTHORIZED,
    );
  }
}
