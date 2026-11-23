// app/tasks/[id]/edit/page.tsx
import MainLayout from '@/components/layout/MainLayout';
import { notFound } from 'next/navigation';
import { connectDB } from '@/lib/db';
import { getTaskById } from '@/services/task.service';
import { requireTaskAccess } from '@/lib/page-guards';
import TaskEditForm from '@/components/task/TaskEditForm';

export default async function TaskEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireTaskAccess(id);

  await connectDB();
  const task = await getTaskById(id);

  if (!task) {
    notFound();
  }

  return (
    <MainLayout>
      <div className="py-4 sm:py-6">
        <TaskEditForm task={task} />
      </div>
    </MainLayout>
  );
}
