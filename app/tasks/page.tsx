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
        <h1 className="mb-8 text-3xl font-bold">Tasks</h1>
        <TaskList tasks={JSON.parse(JSON.stringify(tasks))} />
      </div>
    </MainLayout>
  );
}
