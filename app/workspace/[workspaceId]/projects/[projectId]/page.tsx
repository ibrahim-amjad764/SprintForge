import { connectDB } from '@/lib/db';
import { getProjectWithProgress } from '@/services/project.service';
import { requireWorkspaceAccess, requireProjectInWorkspace } from '@/lib/page-guards';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import logger from '@/lib/logger';

export const revalidate = 0; // Disable static caching for this page

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  logger.info("=== PROJECT DETAIL PAGE INITIALIZED ===");
  
  await connectDB();

  const { workspaceId, projectId } = await params;
  await requireWorkspaceAccess(workspaceId);
  await requireProjectInWorkspace(projectId, workspaceId);
  logger.info({ values: [{ workspaceId, projectId }] }, "Project page params:");
  
  const project = await getProjectWithProgress(projectId);
  logger.info({ values: [project] }, "Project data retrieved:");

  if (!project) {
    logger.info("Project not found, rendering error page");
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Project Not Found</h1>
        <Link
          href={`/workspace/${workspaceId}/projects`}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/workspace/${workspaceId}/projects`}
            className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            ← Back to Projects
          </Link>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="text-gray-600 mt-2">{project.description}</p>
          )}
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href={`/workspace/${workspaceId}/projects/${projectId}/board`}
          className="bg-white rounded-xl border shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Board View</h2>
          <p className="text-sm text-gray-600">View and manage tasks in Kanban board layout</p>
        </Link>

        <Link
          href={`/workspace/${workspaceId}/projects/${projectId}/tasks`}
          className="bg-white rounded-xl border shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Tasks List</h2>
          <p className="text-sm text-gray-600">View all tasks in list format with details</p>
        </Link>

        <Link
          href={`/workspace/${workspaceId}/projects/${projectId}/calendar`}
          className="bg-white rounded-xl border shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Calendar View</h2>
          <p className="text-sm text-gray-600">View tasks and deadlines in calendar format</p>
        </Link>
      </div>

      {/* Project Stats */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <p className="text-lg font-medium capitalize">{project.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Progress</p>
            <p className="text-lg font-medium">{project.progress}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Created</p>
            <p className="text-lg font-medium">
              {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Project ID</p>
            <p className="text-lg font-medium text-sm">{project._id?.toString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
