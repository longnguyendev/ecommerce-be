import { UseGuards } from '@nestjs/common';
import {
  Args,
  Int,
  Mutation,
  Query,
  Resolver,
  Subscription,
} from '@nestjs/graphql';

import { Paginated, PaginationArgs } from '@/common/pagination';
import { UserRole } from '@/generated/prisma/client';

import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MarkAdminNotificationsReadInput } from './dto/mark-read.input';
import { AdminNotification } from './entities/admin-notification.entity';
import {
  NotificationService,
  toNotificationEvent,
} from './notification.service';

const PaginatedAdminNotification = Paginated(AdminNotification);

@Resolver(() => AdminNotification)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class NotificationResolver {
  constructor(private readonly notifications: NotificationService) {}

  @Query(() => PaginatedAdminNotification, { name: 'adminNotifications' })
  adminNotifications(
    @CurrentUser() user: JwtPayload,
    @Args('pagination', { nullable: true }) pagination?: PaginationArgs,
  ) {
    return this.notifications.list(user.sub, pagination);
  }

  @Query(() => Int, { name: 'adminNotificationUnreadCount' })
  adminNotificationUnreadCount(@CurrentUser() user: JwtPayload) {
    return this.notifications.unreadCount(user.sub);
  }

  @Mutation(() => Int, {
    name: 'markAdminNotificationsRead',
    description: 'Trả về số thông báo còn chưa đọc',
  })
  markAdminNotificationsRead(
    @CurrentUser() user: JwtPayload,
    @Args('input') input: MarkAdminNotificationsReadInput,
  ) {
    return this.notifications.markRead(user.sub, input);
  }

  /** Realtime qua graphql-ws (chỉ admin kết nối được — xem core/gql/ws-auth). */
  @Subscription(() => AdminNotification, {
    name: 'adminNotificationCreated',
    resolve: toNotificationEvent,
  })
  adminNotificationCreated() {
    return this.notifications.onCreated();
  }
}
