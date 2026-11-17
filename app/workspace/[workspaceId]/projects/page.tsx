import { connectDB } from '@/lib/db';
import { getProjectsWithProgress } from '@/services/project.service';
import ProjectsClient from '@/components/project/ProjectsClient';
import { requireWorkspaceAccess } from '@/lib/page-guards';
import logger from '@/lib/logger';

export const revalidate = 0; // Disable static caching for this page

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  logger.info("=== PROJECTS PAGE INITIALIZED ===");
  
  await connectDB();

  const { workspaceId } = await params;
  await requireWorkspaceAccess(workspaceId);
  const projects = await getProjectsWithProgress(workspaceId);
  logger.info({ values: [workspaceId] }, "Projects page workspaceId:");

  return (
    <ProjectsClient
      workspaceId={workspaceId}
      projects={JSON.parse(JSON.stringify(projects))}
    />
  );
}
