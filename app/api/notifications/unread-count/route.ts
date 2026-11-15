// app/api/notifications/unread-count/route.ts
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { getUnreadCount } from '@/services/notification.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    // The `user` query param is ignored — identity comes from the JWT
    const count = await getUnreadCount(userId);
    return successResponse({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    return errorResponse('Server error', 500);
  }
}
