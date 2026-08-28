// app/workspace/[workspaceId]/projects/[projectId]/tasks/[taskId]/page.tsx

import Timer from '@/components/time/Timer';

interface Props {
  params: {
    workspaceId: string;
    projectId: string;
    taskId: string;
  };
}

export default function TaskPage({ params }: Props) {
  return (
    <Timer
      taskId={params.taskId}
      userId="CURRENT_USER"
    />
  );
}