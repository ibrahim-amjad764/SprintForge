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
      <h1 className="mb-8 text-3xl font-bold">Project Calendar</h1>
      <LazyCalendarClient initialTasks={JSON.parse(JSON.stringify(tasks))} />
    </div>
  );
}
