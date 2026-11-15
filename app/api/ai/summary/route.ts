// app/api/ai/summary/route.ts
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { generateSummary } from '@/services/ai.service';
import { successResponse, errorResponse } from '@/utils/response';
import { requireAuth } from '@/lib/auth';
import { getMembershipForProject } from '@/lib/authorization';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

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
