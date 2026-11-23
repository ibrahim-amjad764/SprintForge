// app/tasks/page.tsx
import MainLayout from '@/components/layout/MainLayout';
import { connectDB } from '@/lib/db';
import { filterTasks } from '@/services/task.service';
import { getUserWorkspaceIds } from '@/lib/authorization';
import { requirePageUserId } from '@/lib/page-guards';
import TaskList from '@/components/task/TaskList';

export default async function TasksPage() {
  await connectDB();

  // Scope to the user's own workspaces — an unfiltered filterTasks({})
  // would return every task in the database.
  const userId = await requirePageUserId();
  const workspaceIds = await getUserWorkspaceIds(userId);
  const tasks = workspaceIds.length
    ? await filterTasks({ workspace: workspaceIds })
    : [];

  return (
    <MainLayout>
      <div>
        <div className="mb-8">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
            Work
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Tasks</h1>
        </div>
        <TaskList
          tasks={JSON.parse(JSON.stringify(tasks))}
          pollUrls={workspaceIds.map((id) => `/api/tasks?workspace=${id}`)}
        />
      </div>
    </MainLayout>
  );
}
