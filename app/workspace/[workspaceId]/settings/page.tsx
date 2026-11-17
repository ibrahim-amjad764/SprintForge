import { connectDB } from '@/lib/db';
import { getWorkspaceById } from '@/services/workspace.service';
import WorkspaceSettings from '@/components/workspace/WorkspaceSettings';
import WorkspaceMembers from '@/components/workspace/WorkspaceMembers';
import { requireWorkspaceAccess } from '@/lib/page-guards';
import logger from '@/lib/logger';

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  logger.info("=== WORKSPACE SETTINGS PAGE INITIALIZED ===");
  
  const { workspaceId } = await params;
  await requireWorkspaceAccess(workspaceId);
  await connectDB();
  const workspace = await getWorkspaceById(workspaceId);
  logger.info({ values: [workspaceId] }, "Workspace settings page workspaceId:");

  if (!workspace) {
    return (
      <div className="p-10">
        <h1 className="text-2xl font-bold">Workspace not found</h1>
      </div>
    );
  }

  return (
    <div className="p-10">
      <h1 className="mb-8 text-3xl font-bold">Workspace Settings</h1>
      
      <div className="space-y-12">
        <WorkspaceSettings
          workspaceId={workspaceId}
          workspace={JSON.parse(JSON.stringify(workspace))}
        />
        
        <WorkspaceMembers
          workspaceId={workspaceId}
          currentUserId={workspace.owner._id.toString()}
        />
      </div>
    </div>
  );
}
