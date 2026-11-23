import { connectDB } from '@/lib/db';
import { getTasks } from '@/services/task.service';
import LazyCalendarClient from '@/components/calendar/LazyCalendarClient';
import { requireWorkspaceAccess, requireProjectInWorkspace } from '@/lib/page-guards';
import logger from '@/lib/logger';

export const revalidate = 0; // Disable static caching for this page

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  logger.info("=== CALENDAR PAGE INITIALIZED ===");
  
  await connectDB();

  const { workspaceId, projectId } = await params;
  await requireWorkspaceAccess(workspaceId);
  await requireProjectInWorkspace(projectId, workspaceId);
  logger.info({ values: [{ workspaceId, projectId }] }, "Calendar page params:");
  
  const tasks = await getTasks(projectId);
  logger.info({ values: [tasks.length] }, "Tasks loaded for calendar:");

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
          Project
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Calendar</h1>
      </div>
      <LazyCalendarClient initialTasks={JSON.parse(JSON.stringify(tasks))} />
    </div>
  );
}
