// app/api/auth/me/route.ts
import { NextRequest } from "next/server";

import { validateSessionToken } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { errorResponse, successResponse } from "@/utils/response";
import User from "@/models/User";
import { apiError } from '@/utils/error-handler';

/*
    GET CURRENT USER
    Flow:
    Browser
        |
        Cookie
        |
        JWT Verify
        |
        Find User
        |
        Return User

*/

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    // Get tokrn from cookie
    const token = request.cookies.get("token")?.value;

    if (!token) {
      return errorResponse("Not authenticated", 401);
    }

    const session = await validateSessionToken(token);

    if (!session) {
      return errorResponse("Invalid token", 401);
    }

    const user = await User.findById(session.userId).select('_id name email avatar role');

    if (!user) {
      return errorResponse("User not found", 404);
    }
    return successResponse(user, "User fetched");
  } catch (error) {
    return apiError(error, 'Server error');
  }
}
