// services/analytics.service.ts
import Task from '@/models/Task';
import { getUserProjectIds } from '@/lib/authorization';

/*
Analytics Engine

Calculates:

- Completion rate
- Velocity
- User workload
- Team performance

All metrics are scoped to the projects inside workspaces
the given user belongs to.
*/

export async function getAnalytics(userId: string) {
  const projectIds = await getUserProjectIds(userId);
  const taskScope = { project: { $in: projectIds } };

  const totalTasks = await Task.countDocuments(taskScope);

  const completedTasks = await Task.countDocuments({
    ...taskScope,
    status: 'COMPLETED',
  });

  const completionRate =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const workload = await Task.aggregate([
    {
      $match: taskScope,
    },
    {
      $group: {
        _id: '$assignee',

        tasks: {
          $count: {},
        },
      },
    },
  ]);

  const velocity = await Task.aggregate([
    {
      $match: {
        ...taskScope,
        status: 'COMPLETED',
      },
    },

    {
      $group: {
        _id: {
          $week: '$updatedAt',
        },

        completed: {
          $count: {},
        },
      },
    },
  ]);

  return {
    totalTasks,
    completedTasks,
    completionRate,
    workload,
    velocity,
  };
}
