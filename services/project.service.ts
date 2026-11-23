// services/project.service.ts

import mongoose from "mongoose";
import Project from "@/models/Project";
import Task from "@/models/Task";

/*
 Project Service
 Database logic layer.
*/

interface TaskStats {
  total: number;
  completed: number;
}

/*
 * Fetch total/completed task counts for many projects in ONE
 * aggregation instead of 2 countDocuments per project (N+1).
 * Returns a Map keyed by project id string; projects with no
 * tasks simply have no entry.
 */
async function getTaskStats(
  projectIds: mongoose.Types.ObjectId[],
): Promise<Map<string, TaskStats>> {
  const stats = new Map<string, TaskStats>();
  if (projectIds.length === 0) return stats;

  const rows = await Task.aggregate<{
    _id: mongoose.Types.ObjectId;
    total: number;
    completed: number;
  }>([
    { $match: { project: { $in: projectIds } } },
    {
      $group: {
        _id: "$project",
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] },
        },
      },
    },
  ]);

  for (const row of rows) {
    stats.set(row._id.toString(), {
      total: row.total,
      completed: row.completed,
    });
  }
  return stats;
}

function withProgress<T extends { _id: mongoose.Types.ObjectId }>(
  project: T,
  stats: TaskStats | undefined,
) {
  const totalTasks = stats?.total ?? 0;
  const completedTasks = stats?.completed ?? 0;
  const progressPercentage =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    ...project,
    progress: progressPercentage,
    status: progressPercentage === 100 ? "COMPLETED" : "ACTIVE",
  };
}

export async function createProject(data: {
  name: string;
  description?: string;
  workspace: string;
}) {
  return Project.create({
    name: data.name,
    description: data.description,
    workspace: data.workspace,
  });
}

export async function getProjects(workspace: string) {
  return Project.find({ workspace });
}

interface PaginationInput {
  page: number;
  limit: number;
  skip: number;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/*
 * Paginated project list with progress — deterministic
 * createdAt-desc ordering, progress aggregation scoped to the
 * page's project IDs only (getTaskStats is a single $group, so
 * cost scales with page size, not workspace size).
 */
export async function getProjectsPaginated(
  workspace: string,
  pagination: PaginationInput,
): Promise<PaginatedResult<ReturnType<typeof withProgress>>> {
  const { page, limit, skip } = pagination;

  const [projects, total] = await Promise.all([
    Project.find({ workspace })
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Project.countDocuments({ workspace }),
  ]);

  const stats = await getTaskStats(projects.map((p) => p._id));
  const items = projects.map((project) =>
    withProgress(project, stats.get(project._id.toString())),
  );

  return {
    items,
    total,
    page,
    limit,
    hasMore: skip + items.length < total,
  };
}

export async function getProjectsWithProgress(workspace: string) {
  const projects = await Project.find({ workspace }).lean();

  // Single aggregation for all task counts across the workspace's projects
  const stats = await getTaskStats(projects.map((p) => p._id));

  return projects.map((project) =>
    withProgress(project, stats.get(project._id.toString())),
  );
}

export async function getProjectById(id: string) {
  return Project.findById(id);
}

export async function getProjectWithProgress(id: string) {
  const project = await Project.findById(id).lean();
  if (!project) return null;

  const stats = await getTaskStats([project._id]);

  return withProgress(project, stats.get(project._id.toString()));
}

export async function updateProject(id: string, data: any) {
  return Project.findByIdAndUpdate(id, data, { new: true });
}

export async function unarchiveProject(id: string) {
  const project = await Project.findById(id).lean();
  if (!project) return null;

  // Calculate progress to determine correct status
  const stats = await getTaskStats([project._id]);
  const taskStats = stats.get(project._id.toString());
  const totalTasks = taskStats?.total ?? 0;
  const progressPercentage =
    totalTasks > 0
      ? Math.round(((taskStats?.completed ?? 0) / totalTasks) * 100)
      : 0;

  // Set status based on progress
  const status = progressPercentage === 100 ? 'COMPLETED' : 'ACTIVE';

  return Project.findByIdAndUpdate(
    id, 
    { status }, 
    { new: true }
  );
}

export async function deleteProject(id: string) {
  return Project.findByIdAndDelete(id);
}
