import Link from 'next/link';
import { connectDB } from '@/lib/db';
import { getTaskById } from '@/services/task.service';
import { getActivities } from '@/services/activity.service';
import TaskDetail from '@/components/task/TaskDetail';
import CommentBox from '@/components/task/CommentBox';
import ActivityTimeline from '@/components/task/ActivityTimeline';
import FileUploader from '@/components/task/FileUploader';

export default async function TaskPage({
  params,
}: {
  params: Promise<{
    workspaceId: string;
    projectId: string;
    taskId: string;
  }>;
}) {
  console.log("=== TASK DETAIL PAGE INITIALIZED ===");
  
  await connectDB();

  const { taskId } = await params;
  const task = await getTaskById(taskId);
  const activities = await getActivities(taskId);
  console.log("Task detail page taskId:", taskId);

  if (!task) {
    return (
      <h1 className="text-2xl font-bold">Task not found</h1>
    );
  }

  return (
    <div className="space-y-6">
      <TaskDetail task={JSON.parse(JSON.stringify(task))} />
      <FileUploader taskId={taskId} />
      <CommentBox taskId={taskId} />
      <ActivityTimeline activities={JSON.parse(JSON.stringify(activities))} />
    </div>
  );
}
