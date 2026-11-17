// app/workspace/[workspaceId]/projects/[projectId]/tasks/[taskId]/edit/page.tsx

import { connectDB } from '@/lib/db';
import { getTaskById } from '@/services/task.service';
import TaskEditForm from '@/components/task/TaskEditForm';
import { requireTaskAccess } from '@/lib/page-guards';

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{
    workspaceId: string;
    projectId: string;
    taskId: string;
  }>;
}) {
  const { taskId } = await params;
  // Membership is verified against the task's own workspace —
  // URL params alone are never trusted for authorization.
  await requireTaskAccess(taskId);

  await connectDB();
  const task = await getTaskById(taskId);

  return (
    <div className="p-10">
      <TaskEditForm task={JSON.parse(JSON.stringify(task))} />
    </div>
  );
}
