// app/api/notifications/route.ts

import { NextRequest } from 'next/server';

import { connectDB } from '@/lib/db';
import { getUserNotifications, markAllAsRead, getUnreadCount } from '@/services/notification.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireAuth } from '@/lib/auth';

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
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    const { pathname } = request.nextUrl;

    // Handle unread count endpoint
    if (pathname.includes('unread-count')) {
      const count = await getUnreadCount(userId);
      return successResponse({ count });
    }

    const notifications = await getUserNotifications(userId);
    return successResponse(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    return errorResponse('Server error', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
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
    console.error('Patch notifications error:', error);
    return errorResponse('Server error', 500);
  }
}
