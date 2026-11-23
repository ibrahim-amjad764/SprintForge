import TasksClient from '@/components/task/TasksClient';
import { requireWorkspaceAccess, requireProjectInWorkspace } from '@/lib/page-guards';
import logger from '@/lib/logger';

export const revalidate = 0; // Disable static caching for this page

export default async function TasksPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  logger.info("=== PROJECT TASKS PAGE INITIALIZED ===");
  
  const { workspaceId, projectId } = await params;
  await requireWorkspaceAccess(workspaceId);
  await requireProjectInWorkspace(projectId, workspaceId);
  logger.info({ values: [{ workspaceId, projectId }] }, "Project tasks page params:");

  return (
    <div className="h-full">
      <div className="mb-6">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
          Project
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Tasks</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Manage and track all project tasks</p>
      </div>
      <TasksClient projectId={projectId} />
    </div>
  );
}
