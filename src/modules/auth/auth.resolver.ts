import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { AuthService } from './auth.service';
import type { JwtPayload } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { SignInInput } from './dto/sign-in.input';
import { AuthToken } from './entities/auth-token.entity';
import { User } from './entities/user.entity';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Mutation(() => AuthToken, { name: 'signIn' })
  signIn(@Args('input') input: SignInInput): Promise<AuthToken> {
    return this.authService.signIn(input);
  }

  @Public()
  @Mutation(() => AuthToken, { name: 'refreshToken' })
  refresh(@Args('refreshToken') refreshToken: string): Promise<AuthToken> {
    return this.authService.refresh(refreshToken);
  }

  @Query(() => User, { name: 'me' })
  me(@CurrentUser() user: JwtPayload | undefined): Promise<User> {
    if (!user) throw new Error('Unauthenticated');
    return this.authService.me(user.sub);
  }
}
