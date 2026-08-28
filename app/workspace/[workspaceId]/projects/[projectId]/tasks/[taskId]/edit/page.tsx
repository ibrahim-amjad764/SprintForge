// app/workspace/[workspaceId]/projects/[projectId]/tasks/[taskId]/edit/page.tsx

import { connectDB } from '@/lib/db';
import { getTaskById } from '@/services/task.service';
import TaskEditForm from '@/components/task/TaskEditForm';

export default async function EditTaskPage({
  params,
}: {
  params: {
    taskId: string;
  };
}) {
  await connectDB();

  const task = await getTaskById(params.taskId);

  return (
    <div className="p-10">
      <TaskEditForm task={JSON.parse(JSON.stringify(task))} />
    </div>
  );
}
