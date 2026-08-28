import TeamsClient from '@/components/team/TeamsClient';

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  console.log("=== TEAMS PAGE INITIALIZED ===");
  
  const { workspaceId } = await params;
  console.log("Teams page workspaceId:", workspaceId);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">Teams</h1>
      <TeamsClient projectId={workspaceId} projectName="Default Project" workspaceId={workspaceId} />
    </div>
  );
}
