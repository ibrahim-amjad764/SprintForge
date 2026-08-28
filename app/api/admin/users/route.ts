// app/api/admin/users/route.ts
import { NextRequest } from 'next/server';

import { connectDB } from '@/lib/db';
import { getAllUsers } from '@/services/admin.service';
import { successResponse, errorResponse } from '@/utils/response';

export async function GET() {
  try {
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
