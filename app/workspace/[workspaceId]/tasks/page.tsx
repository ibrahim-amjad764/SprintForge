import { connectDB } from '@/lib/db';
import { filterTasks } from '@/services/task.service';
import { getProjects } from '@/services/project.service';
import { getWorkspaceMembers } from '@/services/workspace.service';
import LazyKanbanBoard from '@/components/task/LazyKanbanBoard';
import { requireWorkspaceAccess } from '@/lib/page-guards';
import logger from '@/lib/logger';

export default async function WorkspaceTasksPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  logger.info("=== WORKSPACE TASKS PAGE INITIALIZED ===");
  
  await connectDB();

  const { workspaceId } = await params;
  await requireWorkspaceAccess(workspaceId);
  logger.info({ values: [workspaceId] }, "Workspace tasks page workspaceId:");
  
  const [tasks, projects, members] = await Promise.all([
    filterTasks({ workspace: workspaceId }),
    getProjects(workspaceId),
    getWorkspaceMembers(workspaceId),
  ]);

  // Transform members to team member format
  const teamMembers = members.map((member: any) => ({
    _id: member.user._id?.toString(),
    name: member.user.name || member.user.email.split('@')[0],
    email: member.user.email,
  }));

  return (
    <LazyKanbanBoard
      workspaceId={workspaceId}
      tasks={JSON.parse(JSON.stringify(tasks))}
      projects={JSON.parse(JSON.stringify(projects))}
      teamMembers={teamMembers}
    />
  );
}
