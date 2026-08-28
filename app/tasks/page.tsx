// app/tasks/page.tsx
import MainLayout from '@/components/layout/MainLayout';
import { connectDB } from '@/lib/db';
import { filterTasks } from '@/services/task.service';
import TaskList from '@/components/task/TaskList';

export default async function TasksPage() {
  await connectDB();

  const tasks = await filterTasks({});

  return (
    <MainLayout>
      <div>
        <h1 className="mb-8 text-3xl font-bold">Tasks</h1>
        <TaskList tasks={JSON.parse(JSON.stringify(tasks))} />
      </div>
    </MainLayout>
  );
}
