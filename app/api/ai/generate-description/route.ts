// app/api/ai/generate-description/route.ts

import { NextRequest } from "next/server";
import { validateSessionToken } from "@/lib/session";
import { generateWorkspaceDescription } from "@/services/ai-description.service";
import { successResponse, errorResponse } from "@/utils/response";
import { rateLimit } from "@/lib/rate-limit";

import { apiError } from '@/utils/error-handler';

// AI calls cost real money — cap per user per hour.
const AI_RATE_LIMIT = 20;
const AI_WINDOW_MS = 60 * 60 * 1000;

async function getUserId(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  if (!token) return null;
  const session = await validateSessionToken(token);
  return session?.userId ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return errorResponse("Unauthorized", 401);
    }

    if (!rateLimit(`ai:${userId}`, AI_RATE_LIMIT, AI_WINDOW_MS)) {
      return errorResponse("Too many requests — please try again later", 429);
    }

    const body = await request.json();
    const { name, template, industry, teamSize } = body;

    if (!name) {
      return errorResponse("Workspace name is required", 400);
    }

    const description = await generateWorkspaceDescription({
      name,
      template,
      industry,
      teamSize,
    });

    return successResponse({ description }, "Description generated successfully");
  } catch (error) {
    return apiError(error, 'Failed to generate description');
  }
}
