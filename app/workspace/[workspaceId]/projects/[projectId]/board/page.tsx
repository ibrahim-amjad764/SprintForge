import { connectDB } from '@/lib/db';
import { getTasks } from '@/services/task.service';
import { getProjects } from '@/services/project.service';
import { getWorkspaceMembers } from '@/services/workspace.service';
import KanbanBoard from '@/components/task/KanbanBoard';

export default async function BoardPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  console.log("=== BOARD PAGE INITIALIZED ===");
  
  await connectDB();

  const { workspaceId, projectId } = await params;
  console.log("Board page params:", { workspaceId, projectId });
  
  const tasks = await getTasks(projectId);
  const projects = await getProjects(workspaceId);
  const workspaceMembers = await getWorkspaceMembers(workspaceId);
  
  console.log("Data loaded:", { 
    tasksCount: tasks.length, 
    projectsCount: projects.length, 
    membersCount: workspaceMembers.length 
  });

  // Transform workspace members to match TeamMember interface
  const teamMembers = workspaceMembers
    .filter((member: any) => member.user)
    .map((member: any) => ({
      _id: member.user._id,
      name: member.user.name,
      email: member.user.email,
    }));

  return (
    <KanbanBoard 
      workspaceId={workspaceId}
      tasks={JSON.parse(JSON.stringify(tasks))}
      projects={JSON.parse(JSON.stringify(projects))}
      teamMembers={JSON.parse(JSON.stringify(teamMembers))}
    />
  );
}
