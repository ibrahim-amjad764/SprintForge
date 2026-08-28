// app/api/ai/generate-description/route.ts

import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import { generateWorkspaceDescription } from "@/services/ai-description.service";
import { successResponse, errorResponse } from "@/utils/response";

async function getUserId(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.userId as string;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return errorResponse("Unauthorized", 401);
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
    console.error("AI description generation error:", error);
    return errorResponse("Failed to generate description", 500);
  }
}
