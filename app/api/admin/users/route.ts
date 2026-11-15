// app/api/admin/users/route.ts
import { NextRequest } from 'next/server';

import { connectDB } from '@/lib/db';
import { getAllUsers } from '@/services/admin.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireAdmin } from '@/lib/admin';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.response) return auth.response;

    await connectDB();

    const users = await getAllUsers();

    return successResponse(users);
  } catch (error) {
    return errorResponse(
      'Failed',

      500
    );
  }
}
