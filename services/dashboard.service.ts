// services/dashboard.service.ts
import Task from '@/models/Task';

/*
Dashboard Analytics Service

Calculates:
- Total tasks
- Completed
- Pending
- Overdue
*/

export async function getDashboardStats() {
  const total = await Task.countDocuments();

  const completed = await Task.countDocuments({
    status: 'COMPLETED',
  });

  const pending = await Task.countDocuments({
    status: { $ne: 'COMPLETED' },
  });

  const overdue = await Task.countDocuments({
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
