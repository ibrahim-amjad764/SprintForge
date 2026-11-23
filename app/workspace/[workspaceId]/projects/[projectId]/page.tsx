import { connectDB } from '@/lib/db';
import { getProjectWithProgress } from '@/services/project.service';
import { requireWorkspaceAccess, requireProjectInWorkspace } from '@/lib/page-guards';
import Link from 'next/link';
import { ChevronLeft, LayoutGrid, ListChecks, CalendarDays } from 'lucide-react';
import logger from '@/lib/logger';

export const revalidate = 0; // Disable static caching for this page

const views = [
  {
    href: 'board',
    icon: LayoutGrid,
    title: 'Board View',
    description: 'Manage tasks in a drag-and-drop Kanban layout',
  },
  {
    href: 'tasks',
    icon: ListChecks,
    title: 'Tasks List',
    description: 'View all tasks in list format with details',
  },
  {
    href: 'calendar',
    icon: CalendarDays,
    title: 'Calendar View',
    description: 'See tasks and deadlines on a calendar',
  },
];

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
      <div className="py-12 text-center">
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-foreground">Project Not Found</h1>
        <Link
          href={`/workspace/${workspaceId}/projects`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back to Projects
        </Link>
      </div>
    );
  }

  const base = `/workspace/${workspaceId}/projects/${projectId}`;
  const progress = project.progress ?? 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-enter">
        <Link
          href={`/workspace/${workspaceId}/projects`}
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back to Projects
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{project.name}</h1>
            {project.description && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {project.description}
              </p>
            )}
          </div>
          <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium capitalize text-primary">
            {project.status}
          </span>
        </div>

        {/* Progress */}
        <div className="mt-5 flex items-center gap-3">
          <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {progress}% complete
          </span>
        </div>
      </div>

      {/* View switcher cards */}
      <div className="stagger grid gap-4 md:grid-cols-3">
        {views.map((view, i) => (
          <Link
            key={view.href}
            href={`${base}/${view.href}`}
            style={{ '--i': i } as React.CSSProperties}
            className="group rounded-2xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-popover"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
              <view.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-3 font-semibold tracking-tight">{view.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {view.description}
            </p>
          </Link>
        ))}
      </div>

      {/* Project stats */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <h2 className="mb-4 text-base font-semibold tracking-tight">Project Overview</h2>
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Status</p>
            <p className="mt-1 text-lg font-medium capitalize">{project.status}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Progress</p>
            <p className="mt-1 font-mono text-lg font-medium tabular-nums">{progress}%</p>
          </div>
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Created</p>
            <p className="mt-1 text-lg font-medium">
              {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'N/A'}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Project ID</p>
            <p className="mt-1 truncate font-mono text-sm text-muted-foreground" title={project._id?.toString()}>
              {project._id?.toString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
