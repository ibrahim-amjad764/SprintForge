// services/dashboard.service.ts
import Task from '@/models/Task';
import { getUserProjectIds } from '@/lib/authorization';

/*
Dashboard Analytics Service

Calculates:
- Total tasks
- Completed
- Pending
- Overdue

Stats are scoped to the projects inside workspaces the given
user belongs to — platform-wide counts must never be shown to
individual users.
*/

export async function getDashboardStats(userId: string) {
  const projectIds = await getUserProjectIds(userId);
  const scope = { project: { $in: projectIds } };

  const total = await Task.countDocuments(scope);

  const completed = await Task.countDocuments({
    ...scope,
    status: 'COMPLETED',
  });

  const pending = await Task.countDocuments({
    ...scope,
    status: { $ne: 'COMPLETED' },
  });

  const overdue = await Task.countDocuments({
    ...scope,
    dueDate: { $lt: new Date() },
    status: { $ne: 'COMPLETED' },
  });

  return {
    total,
    completed,
    pending,
    overdue,
  };
}
