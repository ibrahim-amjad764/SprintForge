// app/api/notifications/read-all/route.ts
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { markAllAsRead } from '@/services/notification.service';
import { successResponse, errorResponse } from '@/utils/response';

export async function PATCH(request: NextRequest) {
  try {
    await connectDB();
    const user = request.nextUrl.searchParams.get('user');

    if (!user) {
      return errorResponse('User ID is required', 400);
    }

    await markAllAsRead(user);
    return successResponse(null, 'All notifications marked as read');
  } catch (error) {
    console.error('Mark all as read error:', error);
    return errorResponse('Server error', 500);
  }
}
