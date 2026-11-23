import Link from 'next/link';
import { FolderKanban, ListChecks, Users, ArrowRight } from 'lucide-react';
import { connectDB } from '@/lib/db';
import { getWorkspaceById } from '@/services/workspace.service';
import { requireWorkspaceAccess } from '@/lib/page-guards';
import logger from '@/lib/logger';

const sections = [
  {
    href: 'projects',
    icon: FolderKanban,
    title: 'Projects',
    description: 'Plan sprints, track progress, and ship releases.',
  },
  {
    href: 'tasks',
    icon: ListChecks,
    title: 'Tasks',
    description: 'View and manage every task across the workspace.',
  },
  {
    href: 'teams',
    icon: Users,
    title: 'Teams',
    description: 'Organize members, roles, and responsibilities.',
  },
];

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
    <div className="space-y-8">
      {/* Workspace header */}
      <div className="animate-enter">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
          Workspace
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {workspace.name}
        </h1>
        {workspace.description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {workspace.description}
          </p>
        )}
      </div>

      {/* Section cards */}
      <div className="stagger grid gap-5 md:grid-cols-3">
        {sections.map((section, i) => (
          <Link
            key={section.href}
            href={`${base}/${section.href}`}
            style={{ '--i': i } as React.CSSProperties}
            className="group rounded-2xl border border-border bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-popover"
          >
            <div className="flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                <section.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
            </div>
            <h2 className="mt-4 font-semibold tracking-tight">{section.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {section.description}
            </p>
          </Link>
        ))}
      </div>

      {/* Settings shortcut */}
      <Link
        href={`${base}/settings`}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        Workspace settings
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
