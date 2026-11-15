// services/search.service.ts
import Task from '@/models/Task';
import Project from '@/models/Project';
import User from '@/models/User';
import Workspace from '@/models/Workspace';
import WorkspaceMember from '@/models/WorkspaceMember';
import { connectDB } from '@/lib/db';

/*
Global Search Service

Searches:
Tasks
Projects
Users

All results are scoped to the workspaces the user belongs to
(member rows + owned workspaces) — prevents cross-workspace IDOR.
*/

export async function globalSearch(query: string, userId: string) {
  await connectDB();

  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  // Workspaces the user can access: memberships + owned workspaces
  const [memberRows, owned] = await Promise.all([
    WorkspaceMember.find({ user: userId }).select('workspace').lean(),
    Workspace.find({ owner: userId }).select('_id').lean(),
  ]);

  const workspaceIds = [
    ...memberRows.map((m) => m.workspace),
    ...owned.map((w) => w._id),
  ];

  if (workspaceIds.length === 0) {
    return { tasks: [], projects: [], users: [] };
  }

  const projectIds = await Project.find({ workspace: { $in: workspaceIds } })
    .distinct('_id');

  const memberUserIds = await WorkspaceMember.find({
    workspace: { $in: workspaceIds },
  }).distinct('user');

  const [tasks, projects, users] = await Promise.all([
    Task.find({ title: regex, project: { $in: projectIds } }).limit(10).lean(),
    Project.find({ name: regex, workspace: { $in: workspaceIds } }).limit(10).lean(),
    User.find({ name: regex, _id: { $in: memberUserIds } })
      .select('name email avatar')
      .limit(10)
      .lean(),
  ]);

  return {
    tasks,
    projects,
    users,
  };
}
