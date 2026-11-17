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
      <h1 className="mb-6 text-3xl font-bold">Teams</h1>
      <TeamsClient projectId={workspaceId} projectName="Default Project" workspaceId={workspaceId} />
    </div>
  );
}
