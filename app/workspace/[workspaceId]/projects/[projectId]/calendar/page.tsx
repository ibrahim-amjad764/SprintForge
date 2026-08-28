import { connectDB } from '@/lib/db';
import { getTasks } from '@/services/task.service';
import CalendarClient from '@/components/calendar/CalendarClient';

export const revalidate = 0; // Disable static caching for this page

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  console.log("=== CALENDAR PAGE INITIALIZED ===");
  
  await connectDB();

  const { workspaceId, projectId } = await params;
  console.log("Calendar page params:", { workspaceId, projectId });
  
  const tasks = await getTasks(projectId);
  console.log("Tasks loaded for calendar:", tasks.length);

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold">Project Calendar</h1>
      <CalendarClient initialTasks={JSON.parse(JSON.stringify(tasks))} />
    </div>
  );
}
