// services/analytics.service.ts
import Task from '@/models/Task';
import { getUserProjectIds } from '@/lib/authorization';

/*
Analytics Engine

Calculates:

- Completion rate
- Velocity (tasks completed per ISO week)
- User workload (open + completed task counts per assignee)

All metrics are scoped to the projects inside workspaces
the given user belongs to.
*/

export async function getAnalytics(userId: string) {
  const projectIds = await getUserProjectIds(userId);
  const taskScope = { project: { $in: projectIds } };

  const [totalTasks, completedTasks, workloadRaw, velocityRaw] =
    await Promise.all([
      Task.countDocuments(taskScope),
      Task.countDocuments({ ...taskScope, status: 'COMPLETED' }),
      Task.aggregate([
        { $match: taskScope },
        {
          $group: {
            _id: '$assignee',
            tasks: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] },
            },
          },
        },
        // Resolve assignee ObjectIds to display names
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            userId: '$_id',
            name: { $ifNull: ['$user.name', 'Unassigned'] },
            tasks: 1,
            completed: 1,
          },
        },
        { $sort: { tasks: -1 } },
        { $limit: 20 },
      ]),
      Task.aggregate([
        {
          $match: { ...taskScope, status: 'COMPLETED' },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%G-W%V', // ISO year-week, e.g. "2026-W42"
                date: '$updatedAt',
              },
            },
            completed: { $count: {} },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 26 }, // ~6 months of weekly buckets
      ]),
    ]);

  const completionRate =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  return {
    totalTasks,
    completedTasks,
    completionRate,
    workload: workloadRaw,
    velocity: velocityRaw,
  };
}
