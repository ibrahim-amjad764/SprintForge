// mkdir -p app/api/analytics/export
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';

import Task from '@/models/Task';
import { errorResponse } from '@/utils/response';
import { requireSession } from '@/lib/session';
import { getUserProjectIds } from '@/lib/authorization';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    // Scope export to tasks inside the user's accessible workspaces
    const projectIds = await getUserProjectIds(userId);
    const tasks = await Task.find({ project: { $in: projectIds } });

    const csv = [
      'title,status,priority',

      ...tasks.map((task) => `${task.title},${task.status},${task.priority}`),
    ].join('\n');

    return new Response(
      csv,

      {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename=tasks.csv',
        },
      }
    );
  } catch (error) {
    return errorResponse('Export failed', 500);
  }
}
