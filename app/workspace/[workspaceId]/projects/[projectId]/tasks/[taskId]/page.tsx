// app/workspace/[workspaceId]/projects/[projectId]/tasks/[taskId]/page.tsx

import Timer from '@/components/time/Timer';
import { requireTaskAccess } from '@/lib/page-guards';

export default async function TaskPage({
  params,
}: {
  params: Promise<{
    workspaceId: string;
    projectId: string;
    taskId: string;
  }>;
}) {
  const { taskId } = await params;
  await requireTaskAccess(taskId);

  return <Timer taskId={taskId} userId="CURRENT_USER" />;
}
