// services/task.service.ts
import Task, { ITask } from '@/models/Task'; // Assuming you have an ITask interface
import { sendEmail } from '@/services/email.service';
import { taskAssignedEmail } from '@/components/templates/emails/task-assigned';
import User from '@/models/User';
import Project from '@/models/Project';
import { getIO } from '@/server/socket';
import { createNotification } from '@/services/notification.service';
import logger from '@/lib/logger';

// Unbounded task reads (Kanban/Calendar need full sets) still get a
// ceiling so a pathological query fails fast instead of hanging a
// request worker. 30s is far above normal latency at current scale.
const UNBOUNDED_QUERY_MAX_MS = 30_000;

// 1. Strongly typed DTO (Data Transfer Object) for updates
export type UpdateTaskDTO = Partial<
  Omit<ITask, '_id' | 'createdAt' | 'updatedAt'>
>;

/*
 Task Database Operations
*/

export async function createTask(data: {
  title: string;
  description?: string;
  project: string;
  teamId?: string;
  priority?: string;
  status?: string;
  assignee?: string;
  dueDate?: Date;
}) {
  if (process.env.NODE_ENV === 'development') {
    logger.info({ values: [data] }, '💾 createTask data:');
    logger.info({ values: [data.teamId] }, '👥 Saving teamId:');
    logger.info({ values: [data.assignee] }, '👤 Saving assignee:');
    logger.info({ values: [data.dueDate] }, '📅 Saving dueDate:');
  }
  
  const task = await Task.create(data);
  if (process.env.NODE_ENV === 'development') {
    logger.info({ values: [task._id] }, '✅ Task saved:');
  }
  
  return task;
}

export async function getTasks(project: string) {
  if (process.env.NODE_ENV === 'development') {
    logger.info({ values: [project] }, '📆 Service: getTasks for project:');
  }
  // .lean() converts Mongoose documents to plain JS objects (better performance for JSON responses)
  const tasks = await Task.find({ project })
    .populate({ path: 'assignee', select: '_id name email avatar' })
    .populate('teamId')
    .maxTimeMS(UNBOUNDED_QUERY_MAX_MS)
    .lean();
  if (process.env.NODE_ENV === 'development') {
    logger.info({ values: [tasks.length] }, '📆 Service: Tasks retrieved:');
    tasks.forEach((task: any) => {
      logger.info({ values: [task.dueDate] }, '📅 Service task date:');
      logger.info({ values: [task.assignee] }, '👤 Service task assignee:');
      logger.info({ values: [task.teamId] }, '👥 Service task teamId:');
    });
  }
  return tasks;
}

export async function getTasksByWorkspace(workspace: string) {
  if (process.env.NODE_ENV === 'development') {
    logger.info({ values: [workspace] }, '📆 Service: getTasksByWorkspace for workspace:');
  }
  // Get all projects in the workspace, then fetch tasks from those projects
  const projects = await Project.find({ workspace })
    .select('_id')
    .maxTimeMS(UNBOUNDED_QUERY_MAX_MS)
    .lean();
  const projectIds = projects.map((p) => p._id);
  
  const tasks = await Task.find({ project: { $in: projectIds } })
    .populate({ path: 'assignee', select: '_id name email avatar' })
    .populate('teamId')
    .maxTimeMS(UNBOUNDED_QUERY_MAX_MS)
    .lean();
  
  if (process.env.NODE_ENV === 'development') {
    logger.info({ values: [tasks.length] }, '📆 Service: Workspace tasks retrieved:');
    tasks.forEach((task: any) => {
      logger.info({ values: [task.dueDate] }, '📅 Service task date:');
      logger.info({ values: [task.assignee] }, '👤 Service task assignee:');
      logger.info({ values: [task.teamId] }, '👥 Service task teamId:');
    });
  }
  
  return tasks;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface PaginationInput {
  page: number;
  limit: number;
  skip: number;
}

function paginatedResponse<T>(
  items: T[],
  total: number,
  { page, limit, skip }: PaginationInput,
): PaginatedResult<T> {
  return {
    items,
    total,
    page,
    limit,
    hasMore: skip + items.length < total,
  };
}

/*
 * Paginated variants — deterministic createdAt-desc ordering so
 * offset pages are stable. The legacy unpaginated functions are
 * kept for consumers that need the complete dataset (Kanban,
 * Calendar, server-rendered pages).
 */
export async function getTasksPaginated(
  project: string,
  pagination: PaginationInput,
) {
  const { page, limit, skip } = pagination;
  const [items, total] = await Promise.all([
    Task.find({ project })
      .populate({ path: 'assignee', select: '_id name email avatar' })
      .populate('teamId')
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Task.countDocuments({ project }),
  ]);
  return paginatedResponse(items, total, { page, limit, skip });
}

export async function getTasksByWorkspacePaginated(
  workspace: string,
  pagination: PaginationInput,
) {
  const { page, limit, skip } = pagination;
  const projects = await Project.find({ workspace }).select('_id').lean();
  const projectIds = projects.map((p) => p._id);

  const [items, total] = await Promise.all([
    Task.find({ project: { $in: projectIds } })
      .populate({ path: 'assignee', select: '_id name email avatar' })
      .populate('teamId')
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Task.countDocuments({ project: { $in: projectIds } }),
  ]);
  return paginatedResponse(items, total, { page, limit, skip });
}

export async function getTaskById(id: string) {
  return Task.findById(id).populate({ path: 'assignee', select: '_id name email avatar' }).lean();
}

export async function updateTask(id: string, data: UpdateTaskDTO) {
  // 1. Fetch the old task to compare state (e.g., assignee changes)
  const oldTask = await Task.findById(id).lean();

  if (!oldTask) {
    throw new Error('Task not found'); // In a real app, use a custom NotFoundError
  }

  // 2. Perform the update
  const updatedTask = await Task.findByIdAndUpdate(id, data, { new: true })
    .populate({ path: 'assignee', select: '_id name email avatar' })
    .lean(); // CRITICAL: Use .lean() so it can be safely serialized over WebSockets

  if (!updatedTask) {
    throw new Error('Task update failed');
  }

  // 3. Handle Side Effects (Email) - Non-blocking comparison
  const oldAssigneeId = oldTask.assignee?.toString();
  // Handle both populated (object) and unpopulated (string/ObjectId) states safely
  const newAssigneeId = updatedTask.assignee
    ? (updatedTask.assignee as any)._id?.toString() ||
      updatedTask.assignee.toString()
    : null;

  if (newAssigneeId && newAssigneeId !== oldAssigneeId) {
    const notification = await createNotification({
      user: newAssigneeId,
      type: 'TASK_ASSIGNED',
      title: 'New Task Assigned',
      message: `You were assigned "${updatedTask.title}"`,
      link: `/tasks/${updatedTask._id}`,
    });

    const io = getIO();

    if (io) {
      io.to(`user:${newAssigneeId}`).emit('notification:new', {
        event: 'NOTIFICATION_CREATED',
        data: notification,
      });
    }

    handleTaskAssignmentEmail(updatedTask, newAssigneeId).catch((err) => {
      logger.error({ err: err }, `[Background] Failed to send assignment email for task ${id}:`);
    });
  }

  // 4. Emit Socket Event
  const io = getIO();
  if (io) {
    // SENIOR TIP: Emit to a specific "room" (the project) instead of globally.
    // This prevents users in Project B from receiving socket events for Project A.
    const roomId = `project:${updatedTask.project}`;

    io.to(roomId).emit('task:updated', {
      // Wrap in a standard payload structure for easier frontend parsing
      event: 'TASK_UPDATED',
      data: updatedTask,
    });
  }

  return updatedTask;
}

export async function deleteTask(id: string) {
  const deletedTask = await Task.findByIdAndDelete(id).lean();

  const io = getIO();
  if (io && deletedTask) {
    io.to(`project:${deletedTask.project}`).emit('task:deleted', {
      event: 'TASK_DELETED',
      data: { _id: id, project: deletedTask.project },
    });
  }

  return deletedTask;
}

export async function filterTasks(filters: any) {
  const query: any = {};

  if (filters.status) query.status = filters.status;
  if (filters.priority) query.priority = filters.priority;
  if (filters.project) query.project = filters.project;

  if (filters.workspace) {
    // Accepts a single workspace ID or an array — callers scoping to
    // "all of a user's workspaces" pass the array form.
    const workspaceFilter = Array.isArray(filters.workspace)
      ? { $in: filters.workspace }
      : filters.workspace;
    const projects = await Project.find({ workspace: workspaceFilter })
      .select('_id')
      .maxTimeMS(UNBOUNDED_QUERY_MAX_MS)
      .lean();
    query.project = { $in: projects.map((project) => project._id) };
  }

  return Task.find(query).maxTimeMS(UNBOUNDED_QUERY_MAX_MS).lean();
}

// --- Helper Functions ---

/**
 * Isolates email logic to keep updateTask clean.
 * Uses environment variable instead of hardcoded localhost.
 */
async function handleTaskAssignmentEmail(task: any, assigneeId: string) {
  const assignee = await User.findById(assigneeId).lean();

  if (!assignee) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  await sendEmail({
    to: assignee.email,
    subject: `New Task Assigned: ${task.title}`,
    html: taskAssignedEmail(task.title, `${appUrl}/tasks/${task._id}`),
  });
}
