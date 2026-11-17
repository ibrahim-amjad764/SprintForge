// app/api/workspace/validate-slug/route.ts

import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { validateSessionToken } from "@/lib/session";
import Workspace from "@/models/Workspace";
import { successResponse, errorResponse } from "@/utils/response";
import logger from '@/lib/logger';

async function getUserId(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  if (!token) return null;
  const session = await validateSessionToken(token);
  return session?.userId ?? null;
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const userId = await getUserId(request);
    if (!userId) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await request.json();
    const { slug, workspaceId } = body;

    if (!slug) {
      return errorResponse("Slug is required", 400);
    }

    // Check if slug exists (excluding current workspace if editing)
    const query: any = { slug };
    if (workspaceId) {
      query._id = { $ne: workspaceId };
    }

    const existing = await Workspace.findOne(query);
    const available = !existing;

    // Generate alternatives if not available
    let alternatives: string[] = [];
    if (!available) {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 5);
      
      alternatives = [
        `${slug}-${timestamp}`,
        `${slug}-${random}`,
        `${slug}-${timestamp}-${random}`,
      ];
    }

    return successResponse(
      { available, alternatives },
      available ? "Slug is available" : "Slug is already taken"
    );
  } catch (error) {
    logger.error({ err: error }, "Slug validation error:");
    return errorResponse("Server error", 500);
  }
}
