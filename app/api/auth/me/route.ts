// app/api/auth/me/route.ts
import { NextRequest } from "next/server";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse, successResponse } from "@/utils/response";
import User from "@/models/User";

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

    const payload = await verifyToken(token);

    if (!payload) {
      return errorResponse("Invalid token", 401);
    }

    const user = await User.findById(payload.userId).select("-password");

    if (!user) {
      return errorResponse("User not found", 404);
    }
    return successResponse(user, "User fetched");
  } catch (error) {
    return errorResponse("Server error", 500);
  }
}
