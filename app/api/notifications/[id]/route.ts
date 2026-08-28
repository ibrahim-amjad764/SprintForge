// app/api/notifications/[id]/route.ts
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { markRead } from '@/services/notification.service';
import { successResponse } from '@/utils/response';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const { id } = await params;
  const result = await markRead(id);

  return successResponse(result);
}
