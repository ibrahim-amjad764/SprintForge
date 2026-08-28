// app/api/ai/summary/route.ts
import { NextRequest } from 'next/server';
import { generateSummary } from '@/services/ai.service';
import { successResponse } from '@/utils/response';

export async function POST(request: NextRequest) {
  const body = await request.json();

  const result = await generateSummary(body.project);

  return successResponse(result);
}
