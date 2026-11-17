// app/workspace/[workspaceId]/tasks/[taskId]/page.tsx

import Timer from '@/components/time/Timer';
import { requireTaskAccess } from '@/lib/page-guards';

export default async function TaskPage({
  params,
}: {
  params: Promise<{ workspaceId: string; taskId: string }>;
}) {
  const { taskId } = await params;
  // Verifies the task's owning workspace membership — covers both
  // the URL workspace and the task's actual project binding.
  await requireTaskAccess(taskId);

  return <Timer taskId={taskId} userId="CURRENT_USER" />;
}
