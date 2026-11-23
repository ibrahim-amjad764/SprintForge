// mkdir -p app/api/analytics/export
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';

import Task from '@/models/Task';

import { requireSession } from '@/lib/session';
import { getUserProjectIds } from '@/lib/authorization';
import { apiError } from '@/utils/error-handler';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const userId = auth.user.userId;

    await connectDB();

    // Scope export to tasks inside the user's accessible workspaces
    const projectIds = await getUserProjectIds(userId);
    const tasks = await Task.find({ project: { $in: projectIds } });

    // RFC 4180 escaping + spreadsheet formula-injection guard
    const cell = (value: unknown): string => {
      let s = String(value ?? '');
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const csv = [
      'title,status,priority,dueDate',

      ...tasks.map((task) =>
        [task.title, task.status, task.priority, task.dueDate ?? '']
          .map(cell)
          .join(',')
      ),
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
    return apiError(error, 'Export failed');
  }
}
