// app/api/admin/logs/route.ts
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { getLogs } from '@/services/audit.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireAdmin } from '@/lib/admin';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.response) return auth.response;

    await connectDB();

    const logs = await getLogs();

    return successResponse(logs);
  } catch (error) {
    console.error('Get admin logs error:', error);
    return errorResponse('Failed to fetch logs', 500);
  }
}
