// app/tasks/[id]/page.tsx
import MainLayout from '@/components/layout/MainLayout';
import { connectDB } from '@/lib/db';
import { getTaskById } from '@/services/task.service';
import TaskDetail from '@/components/task/TaskDetail';

export default async function TaskDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await connectDB();

  const task = await getTaskById(params.id);

  return (
    <MainLayout>
      <div className="p-10">
        <TaskDetail task={task} />
      </div>
    </MainLayout>
  );
}
