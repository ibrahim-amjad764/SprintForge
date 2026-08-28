import TasksClient from '@/components/task/TasksClient';

export const revalidate = 0; // Disable static caching for this page

export default async function TasksPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  console.log("=== PROJECT TASKS PAGE INITIALIZED ===");
  
  const { workspaceId, projectId } = await params;
  console.log("Project tasks page params:", { workspaceId, projectId });

  return (
    <div className="h-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Tasks List</h1>
        <p className="text-gray-600 mt-2">Manage and track all project tasks</p>
      </div>
      <TasksClient projectId={projectId} />
    </div>
  );
}
