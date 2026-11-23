import { connectDB } from '@/lib/db';
import { getTasks } from '@/services/task.service';
import { getProjects } from '@/services/project.service';
import { getWorkspaceMembers } from '@/services/workspace.service';
import TaskList from '@/components/task/TaskList';
import { requireWorkspaceAccess, requireProjectInWorkspace } from '@/lib/page-guards';
import logger from '@/lib/logger';

export default async function TaskListPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  logger.info("=== TASK LIST PAGE INITIALIZED ===");
  
  await connectDB();

  const { workspaceId, projectId } = await params;
  await requireWorkspaceAccess(workspaceId);
  await requireProjectInWorkspace(projectId, workspaceId);
  logger.info({ values: [{ workspaceId, projectId }] }, "Task list page params:");
  
  const [tasks, projects, workspaceMembers] = await Promise.all([
    getTasks(projectId),
    getProjects(workspaceId),
    getWorkspaceMembers(workspaceId),
  ]);
  
  logger.info({ values: [{
    tasksCount: tasks.length, 
    projectsCount: projects.length, 
    membersCount: workspaceMembers.length 
  }] }, "Data loaded:");

  // Transform workspace members to match TeamMember interface
  const teamMembers = workspaceMembers
    .filter((member: any) => member.user)
    .map((member: any) => ({
      _id: member.user._id,
      name: member.user.name,
      email: member.user.email,
    }));

  return (
    <TaskList 
      workspaceId={workspaceId}
      projectId={projectId}
      tasks={JSON.parse(JSON.stringify(tasks))}
      projects={JSON.parse(JSON.stringify(projects))}
      teamMembers={JSON.parse(JSON.stringify(teamMembers))}
      pollUrls={[`/api/tasks?project=${projectId}`]}
    />
  );
}