// app/api/notifications/route.ts

import { NextRequest } from 'next/server';

import { connectDB } from '@/lib/db';
import { getUserNotifications, markAllAsRead, getUnreadCount } from '@/services/notification.service';
import { successResponse, errorResponse } from '@/utils/response';

/*
  Notification APIs:
  - GET /api/notifications?user=<userId> - Get user notifications
  - GET /api/notifications/unread-count?user=<userId> - Get unread count
  - PATCH /api/notifications/read-all?user=<userId> - Mark all as read
*/

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { pathname } = request.nextUrl;
    const user = request.nextUrl.searchParams.get('user');

    if (!user) {
      return errorResponse('User ID is required', 400);
    }

    // Handle unread count endpoint
    if (pathname.includes('unread-count')) {
      const count = await getUnreadCount(user);
      return successResponse({ count });
    }

    const notifications = await getUserNotifications(user);
    return successResponse(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    return errorResponse('Server error', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await connectDB();

    const { pathname } = request.nextUrl;
    const user = request.nextUrl.searchParams.get('user');

    if (!user) {
      return errorResponse('User ID is required', 400);
    }

    // Handle mark all as read endpoint
    if (pathname.includes('read-all')) {
      await markAllAsRead(user);
      return successResponse(null, 'All notifications marked as read');
    }

    return errorResponse('Invalid endpoint', 404);
  } catch (error) {
    console.error('Patch notifications error:', error);
    return errorResponse('Server error', 500);
  }
}
