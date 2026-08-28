// app/api/admin/logs/route.ts
import { connectDB } from '@/lib/db';
import { getLogs } from '@/services/audit.service';
import { successResponse } from '@/utils/response';

export async function GET() {
  await connectDB();

  const logs = await getLogs();

  return successResponse(logs);
}
