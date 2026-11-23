import TeamsClient from '@/components/team/TeamsClient';
import { requireWorkspaceAccess } from '@/lib/page-guards';
import logger from '@/lib/logger';

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  logger.info("=== TEAMS PAGE INITIALIZED ===");
  
  const { workspaceId } = await params;
  await requireWorkspaceAccess(workspaceId);
  logger.info({ values: [workspaceId] }, "Teams page workspaceId:");

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
          Workspace
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Teams</h1>
      </div>
      <TeamsClient projectId={workspaceId} projectName="Default Project" workspaceId={workspaceId} />
    </div>
  );
}
