// app/api/notifications/[id]/route.ts
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import Notification from '@/models/Notification';
import { markRead } from '@/services/notification.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireSession } from '@/lib/session';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSession(req);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    const { id } = await params;

    // IDOR: users may only mark their own notifications as read
    const notification = await Notification.findById(id).select('user').lean();
    if (!notification || String(notification.user) !== userId) {
      return errorResponse('Forbidden', 403);
    }

    const result = await markRead(id);

    return successResponse(result);
  } catch (error) {
    return errorResponse('Server error', 500);
  }
}
