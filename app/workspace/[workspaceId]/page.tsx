import Link from 'next/link';
import { connectDB } from '@/lib/db';
import { getWorkspaceById } from '@/services/workspace.service';
import { requireWorkspaceAccess } from '@/lib/page-guards';
import logger from '@/lib/logger';

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  logger.info("=== WORKSPACE PAGE INITIALIZED ===");
  
  await connectDB();

  const { workspaceId } = await params;
  await requireWorkspaceAccess(workspaceId);
  const workspace = await getWorkspaceById(workspaceId);
  logger.info({ values: [workspace] }, "Workspace data:");

  if (!workspace) {
    return (
      <div className="p-10">
        <h1 className="text-2xl font-bold">Workspace not found</h1>
        <Link href="/dashboard" className="mt-4 inline-block text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const base = `/workspace/${workspaceId}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">{workspace.name}</h1>
        <p className="mt-2 text-muted-foreground">
          {workspace.description || 'Workspace dashboard'}
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Link
          href={`${base}/projects`}
          className="rounded-lg border p-5 transition hover:bg-muted"
        >
          <h3 className="font-semibold">Projects</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage workspace projects
          </p>
        </Link>
        <Link
          href={`${base}/tasks`}
          className="rounded-lg border p-5 transition hover:bg-muted"
        >
          <h3 className="font-semibold">Tasks</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage tasks
          </p>
        </Link>
        <Link
          href={`${base}/teams`}
          className="rounded-lg border p-5 transition hover:bg-muted"
        >
          <h3 className="font-semibold">Teams</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize your teams
          </p>
        </Link>
      </div>
    </div>
  );
}
