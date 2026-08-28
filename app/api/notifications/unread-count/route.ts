// app/api/notifications/unread-count/route.ts
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { getUnreadCount } from '@/services/notification.service';
import { successResponse, errorResponse } from '@/utils/response';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const user = request.nextUrl.searchParams.get('user');

    if (!user) {
      return errorResponse('User ID is required', 400);
    }

    const count = await getUnreadCount(user);
    return successResponse({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    return errorResponse('Server error', 500);
  }
}
