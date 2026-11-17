// app/api/notifications/route.ts

import { NextRequest } from 'next/server';

import { connectDB } from '@/lib/db';
import { getUserNotifications, getUserNotificationsPaginated, markAllAsRead, getUnreadCount } from '@/services/notification.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireSession } from '@/lib/session';
import { parsePaginationParams } from '@/lib/pagination';
import logger from '@/lib/logger';

/*
  Notification APIs:
  - GET /api/notifications?user=<userId> - Get user notifications
  - GET /api/notifications/unread-count?user=<userId> - Get unread count
  - PATCH /api/notifications/read-all?user=<userId> - Mark all as read

  The authenticated user is always derived from the JWT —
  the `user` query param is accepted for backward compatibility
  but never trusted.
*/

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    const { pathname } = request.nextUrl;

    // Handle unread count endpoint
    if (pathname.includes('unread-count')) {
      const count = await getUnreadCount(userId);
      return successResponse({ count });
    }

    // Opt-in pagination: only when the client passes page/limit.
    // Otherwise the legacy full-array response is preserved.
    const sp = request.nextUrl.searchParams;
    if (sp.has('page') || sp.has('limit')) {
      const pagination = parsePaginationParams(sp);
      if ('error' in pagination) {
        return errorResponse(pagination.error, 400);
      }
      const result = await getUserNotificationsPaginated(userId, pagination);
      return successResponse(result);
    }

    const notifications = await getUserNotifications(userId);
    return successResponse(notifications);
  } catch (error) {
    logger.error({ err: error }, 'Get notifications error:');
    return errorResponse('Server error', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    const { pathname } = request.nextUrl;

    // Handle mark all as read endpoint
    if (pathname.includes('read-all')) {
      await markAllAsRead(userId);
      return successResponse(null, 'All notifications marked as read');
    }

    return errorResponse('Invalid endpoint', 404);
  } catch (error) {
    logger.error({ err: error }, 'Patch notifications error:');
    return errorResponse('Server error', 500);
  }
}
