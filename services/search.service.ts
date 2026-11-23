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
Tasks (title + description)
Projects (name + description)
Users (name, workspace members only)

All results are scoped to the workspaces the user belongs to
(member rows + owned workspaces) — prevents cross-workspace IDOR.

Matching is substring/regex based so partial words still match;
queries are escaped before use. Results are capped per type and
sorted by most recently updated.
*/

const RESULT_LIMIT = 10;
const SNIPPET_LENGTH = 160;

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function snippet(text: string | undefined, matchIndex = 0): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= SNIPPET_LENGTH) return clean;
  const start = Math.max(0, matchIndex - 40);
  const slice = clean.slice(start, start + SNIPPET_LENGTH);
  return `${start > 0 ? '…' : ''}${slice}${start + SNIPPET_LENGTH < clean.length ? '…' : ''}`;
}

export async function globalSearch(query: string, userId: string) {
  await connectDB();

  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { tasks: [], projects: [], users: [] };
  }

  const regex = new RegExp(escapeRegex(trimmed.slice(0, 200)), 'i');

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
    Task.find({
      $or: [{ title: regex }, { description: regex }],
      project: { $in: projectIds },
    })
      .select('title description status project updatedAt')
      .sort({ updatedAt: -1 })
      .limit(RESULT_LIMIT)
      .lean(),
    Project.find({
      $or: [{ name: regex }, { description: regex }],
      workspace: { $in: workspaceIds },
    })
      .select('name description workspace updatedAt')
      .sort({ updatedAt: -1 })
      .limit(RESULT_LIMIT)
      .lean(),
    User.find({ name: regex, _id: { $in: memberUserIds } })
      .select('name email avatar')
      .limit(RESULT_LIMIT)
      .lean(),
  ]);

  return {
    tasks: tasks.map((t) => ({
      _id: t._id,
      title: t.title,
      status: t.status,
      project: t.project,
      snippet: snippet(t.description),
    })),
    projects: projects.map((p) => ({
      _id: p._id,
      name: p.name,
      workspace: p.workspace,
      snippet: snippet(p.description),
    })),
    users: users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
    })),
  };
}
