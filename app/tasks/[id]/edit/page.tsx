// app/tasks/[id]/edit/page.tsx
import MainLayout from '@/components/layout/MainLayout';
import { connectDB } from '@/lib/db';
import { getTaskById } from '@/services/task.service';
import TaskEditForm from '@/components/task/TaskEditForm';

export default async function TaskEditPage({
  params,
}: {
  params: { id: string };
}) {
  await connectDB();

  const task = await getTaskById(params.id);

  return (
    <MainLayout>
      <div className="p-10">
        <TaskEditForm task={task} />
      </div>
    </MainLayout>
  );
}
