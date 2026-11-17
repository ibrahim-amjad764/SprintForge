// app/tasks/[id]/page.tsx
import MainLayout from '@/components/layout/MainLayout';
import { connectDB } from '@/lib/db';
import { getTaskById } from '@/services/task.service';
import { requireTaskAccess } from '@/lib/page-guards';
import TaskDetail from '@/components/task/TaskDetail';

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireTaskAccess(id);

  await connectDB();
  const task = await getTaskById(id);

  return (
    <MainLayout>
      <div className="p-10">
        <TaskDetail task={task} />
      </div>
    </MainLayout>
  );
}
