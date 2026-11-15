// services/data-retention.service.ts
import Workspace from '@/models/Workspace';
import mongoose from 'mongoose';

export interface DataRetentionSchedule {
  workspaceId: string;
  retentionDays: number;
  scheduledAt: Date;
  action: 'archive' | 'delete';
}

// Schedule data retention task for a workspace
export async function scheduleDataRetention(workspaceId: string, retentionDays: number): Promise<void> {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new Error('Workspace not found');
  }

  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() + retentionDays);

  await Workspace.findByIdAndUpdate(workspaceId, {
    dataRetentionDays: retentionDays,
    dataRetentionScheduledAt: scheduledDate,
  });
}

// Check and execute pending data retention tasks
export async function executeDataRetentionTasks(): Promise<void> {
  const now = new Date();
  
  const workspacesToProcess = await Workspace.find({
    dataRetentionScheduledAt: { $lte: now },
  });

  for (const workspace of workspacesToProcess) {
    try {
      await processWorkspaceRetention(workspace);
    } catch (error) {
      console.error(`Failed to process retention for workspace ${workspace._id}:`, error);
    }
  }
}

// Process retention for a single workspace
async function processWorkspaceRetention(workspace: any): Promise<void> {
  const action = workspace.compliancePolicies?.gdprCompliant ? 'archive' : 'delete';
  
  if (action === 'archive') {
    await archiveWorkspaceData(workspace._id);
  } else {
    await deleteWorkspaceData(workspace._id);
  }

  // Reset the schedule
  await Workspace.findByIdAndUpdate(workspace._id, {
    dataRetentionScheduledAt: null,
  });
}

// Archive workspace data (for GDPR compliance)
async function archiveWorkspaceData(workspaceId: string): Promise<void> {
  const Project = (await import('@/models/Project')).default;
  const Task = (await import('@/models/Task')).default;
  const Comment = (await import('@/models/Comment')).default;
  const Activity = (await import('@/models/Activity')).default;

  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    // Get all projects
    const projects = await Project.find({ workspace: workspaceId }).session(session);
    const projectIds = projects.map(p => p._id);

    // Archive tasks
    await Task.updateMany(
      { project: { $in: projectIds } },
      { $set: { archived: true, archivedAt: new Date() } },
      { session }
    );

    // Archive comments
    await Comment.updateMany(
      { task: { $in: projectIds } },
      { $set: { archived: true, archivedAt: new Date() } },
      { session }
    );

    // Archive activities
    await Activity.updateMany(
      { task: { $in: projectIds } },
      { $set: { archived: true, archivedAt: new Date() } },
      { session }
    );

    // Archive projects
    await Project.updateMany(
      { workspace: workspaceId },
      { $set: { archived: true, archivedAt: new Date() } },
      { session }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

// Delete workspace data permanently
async function deleteWorkspaceData(workspaceId: string): Promise<void> {
  const workspaceService = (await import('@/services/workspace.service'));
  await workspaceService.deleteWorkspace(workspaceId);
}

// Get retention status for a workspace
export async function getRetentionStatus(workspaceId: string): Promise<{
  scheduled: boolean;
  scheduledDate?: Date;
  daysRemaining?: number;
  action: 'archive' | 'delete';
}> {
  const workspace = await Workspace.findById(workspaceId);
  
  if (!workspace) {
    throw new Error('Workspace not found');
  }

  if (!workspace.dataRetentionScheduledAt) {
    return {
      scheduled: false,
      action: 'delete',
    };
  }

  const now = new Date();
  const daysRemaining = Math.ceil(
    (workspace.dataRetentionScheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    scheduled: true,
    scheduledDate: workspace.dataRetentionScheduledAt,
    daysRemaining: Math.max(0, daysRemaining),
    action: 'delete',
  };
}

// Cancel scheduled retention
export async function cancelRetentionSchedule(workspaceId: string): Promise<void> {
  await Workspace.findByIdAndUpdate(workspaceId, {
    dataRetentionScheduledAt: null,
  });
}
