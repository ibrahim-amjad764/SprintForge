// app/api/notifications/read-all/route.ts
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { markAllAsRead } from '@/services/notification.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireAuth } from '@/lib/auth';

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    // The `user` query param is ignored — identity comes from the JWT
    await markAllAsRead(userId);
    return successResponse(null, 'All notifications marked as read');
  } catch (error) {
    console.error('Mark all as read error:', error);
    return errorResponse('Server error', 500);
  }
}
