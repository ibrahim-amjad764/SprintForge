// app/api/ai/summary/route.ts
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { generateSummary } from '@/services/ai.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireSession } from '@/lib/session';
import { getMembershipForProject } from '@/lib/authorization';
import { rateLimit } from '@/lib/rate-limit';

// AI calls cost real money — cap per user per hour.
const AI_RATE_LIMIT = 20;
const AI_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    if (!rateLimit(`ai:${userId}`, AI_RATE_LIMIT, AI_WINDOW_MS)) {
      return errorResponse('Too many requests — please try again later', 429);
    }

    await connectDB();
    const body = await request.json();

    // IDOR: user must be a member of the project's workspace
    if (!body.project || !(await getMembershipForProject(String(body.project), userId))) {
      return errorResponse('Forbidden', 403);
    }

    const result = await generateSummary(body.project);

    return successResponse(result);
  } catch (error) {
    return errorResponse('AI failed', 500);
  }
}
