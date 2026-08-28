import { connectDB } from '@/lib/db';
import { getProjectsWithProgress } from '@/services/project.service';
import ProjectsClient from '@/components/project/ProjectsClient';

export const revalidate = 0; // Disable static caching for this page

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  console.log("=== PROJECTS PAGE INITIALIZED ===");
  
  await connectDB();

  const { workspaceId } = await params;
  const projects = await getProjectsWithProgress(workspaceId);
  console.log("Projects page workspaceId:", workspaceId);

  return (
    <ProjectsClient
      workspaceId={workspaceId}
      projects={JSON.parse(JSON.stringify(projects))}
    />
  );
}
