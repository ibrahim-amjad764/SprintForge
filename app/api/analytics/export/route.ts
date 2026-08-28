// mkdir -p app/api/analytics/export
import { connectDB } from '@/lib/db';

import Task from '@/models/Task';

export async function GET() {
  await connectDB();

  const tasks = await Task.find();

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
}
