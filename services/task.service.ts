// services/task.service.ts
import Task, { ITask } from '@/models/Task'; // Assuming you have an ITask interface
import { sendEmail } from '@/services/email.service';
import { taskAssignedEmail } from '@/components/templates/emails/task-assigned';
import User from '@/models/User';
import { getIO } from '@/server/socket';
import { createNotification } from '@/services/notification.service';

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
  console.log('💾 createTask data:', data);
  console.log('👥 Saving teamId:', data.teamId);
  console.log('👤 Saving assignee:', data.assignee);
  console.log('📅 Saving dueDate:', data.dueDate);
  
  const task = await Task.create(data);
  console.log('✅ Task saved:', task._id);
  
  return task;
}

export async function getTasks(project: string) {
  console.log('📆 Service: getTasks for project:', project);
  // .lean() converts Mongoose documents to plain JS objects (better performance for JSON responses)
  const tasks = await Task.find({ project }).populate('assignee').populate('teamId').lean();
  console.log('📆 Service: Tasks retrieved:', tasks.length);
  tasks.forEach((task: any) => {
    console.log('📅 Service task date:', task.dueDate);
    console.log('👤 Service task assignee:', task.assignee);
    console.log('👥 Service task teamId:', task.teamId);
  });
  return tasks;
}

export async function getTasksByWorkspace(workspace: string) {
  console.log('📆 Service: getTasksByWorkspace for workspace:', workspace);
  // Get all projects in the workspace, then fetch tasks from those projects
  const Project = (await import('@/models/Project')).default;
  const projects = await Project.find({ workspace }).select('_id').lean();
  const projectIds = projects.map((p) => p._id);
  
  const tasks = await Task.find({ project: { $in: projectIds } })
    .populate('assignee')
    .populate('teamId')
    .lean();
  
  console.log('📆 Service: Workspace tasks retrieved:', tasks.length);
  tasks.forEach((task: any) => {
    console.log('📅 Service task date:', task.dueDate);
    console.log('👤 Service task assignee:', task.assignee);
    console.log('👥 Service task teamId:', task.teamId);
  });
  
  return tasks;
}

export async function getTaskById(id: string) {
  return Task.findById(id).populate('assignee').lean();
}

export async function updateTask(id: string, data: UpdateTaskDTO) {
  // 1. Fetch the old task to compare state (e.g., assignee changes)
  const oldTask = await Task.findById(id).lean();

  if (!oldTask) {
    throw new Error('Task not found'); // In a real app, use a custom NotFoundError
  }

  // 2. Perform the update
  const updatedTask = await Task.findByIdAndUpdate(id, data, { new: true })
    .populate('assignee')
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
      console.error(
        `[Background] Failed to send assignment email for task ${id}:`,
        err
      );
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
    const Project = (await import('@/models/Project')).default;
    const projects = await Project.find({ workspace: filters.workspace })
      .select('_id')
      .lean();
    query.project = { $in: projects.map((project) => project._id) };
  }

  return Task.find(query).lean();
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
