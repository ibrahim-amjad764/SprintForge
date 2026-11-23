// app/api/notifications/read-all/route.ts
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { markAllAsRead } from '@/services/notification.service';
import { successResponse } from '@/utils/response';
import { requireSession } from '@/lib/session';
import { apiError } from '@/utils/error-handler';

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    // The `user` query param is ignored — identity comes from the JWT
    await markAllAsRead(userId);
    return successResponse(null, 'All notifications marked as read');
  } catch (error) {
    return apiError(error, 'Server error');
  }
}
