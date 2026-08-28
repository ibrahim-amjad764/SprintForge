// services/analytics.service.ts
import Task from '@/models/Task';

import User from '@/models/User';

/*
Analytics Engine

Calculates:

- Completion rate
- Velocity
- User workload
- Team performance
*/

export async function getAnalytics() {
  const totalTasks = await Task.countDocuments();

  const completedTasks = await Task.countDocuments({
    status: 'COMPLETED',
  });

  const completionRate =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const workload = await Task.aggregate([
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
