// app/api/users/route.ts
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { successResponse, errorResponse } from '@/utils/response';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const users = await User.find().select('-password');
    return successResponse(users);
  } catch (error) {
    return errorResponse('Failed to fetch users', 500);
  }
}
