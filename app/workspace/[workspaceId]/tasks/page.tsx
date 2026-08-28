import { connectDB } from '@/lib/db';
import { filterTasks } from '@/services/task.service';
import { getProjects } from '@/services/project.service';
import { getWorkspaceMembers } from '@/services/workspace.service';
import KanbanBoard from '@/components/task/KanbanBoard';

export default async function WorkspaceTasksPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  console.log("=== WORKSPACE TASKS PAGE INITIALIZED ===");
  
  await connectDB();

  const { workspaceId } = await params;
  console.log("Workspace tasks page workspaceId:", workspaceId);
  
  const tasks = await filterTasks({ workspace: workspaceId });
  const projects = await getProjects(workspaceId);
  const members = await getWorkspaceMembers(workspaceId);

  // Transform members to team member format
  const teamMembers = members.map((member: any) => ({
    _id: member.user._id?.toString(),
    name: member.user.name || member.user.email.split('@')[0],
    email: member.user.email,
  }));

  return (
    <KanbanBoard
      workspaceId={workspaceId}
      tasks={JSON.parse(JSON.stringify(tasks))}
      projects={JSON.parse(JSON.stringify(projects))}
      teamMembers={teamMembers}
    />
  );
}
