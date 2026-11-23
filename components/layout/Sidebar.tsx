'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Briefcase,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PlusCircle,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';

import WorkspaceSwitcher from '@/components/workspace/WorkspaceSwitcher';
import useAuth from '@/hooks/useAuth';
import { useIsClient } from '@/hooks/useIsClient';
import { useLocalStorageSubscription } from '@/hooks/useLocalStorageSubscription';

function getWorkspaceId(pathname: string | null): string | null {
  if (!pathname) return null;

  const match = pathname.match(/^\/workspace\/([^/]+)/);
  const id = match?.[1];

  return id && id !== 'new' ? id : null;
}

type NavLinkProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  pathname: string | null;
  count?: number;
};

function NavLink({ href, label, icon: Icon, pathname, count }: NavLinkProps) {
  const isActive =
    pathname === href || (href !== '/dashboard' && pathname?.startsWith(href));

  return (
    <li>
      <Link
        href={href}
        aria-current={isActive ? 'page' : undefined}
        className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
          isActive
            ? 'bg-primary/10 text-primary shadow-[inset_2px_0_0_0_var(--primary)]'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        <Icon
          className={`h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}
          aria-hidden="true"
        />
        <span className="flex-1 truncate">{label}</span>

        {typeof count === 'number' && count > 0 && (
          <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[11px] leading-none font-medium text-primary">
            {count}
          </span>
        )}
      </Link>
    </li>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const workspaceId = getWorkspaceId(pathname);

  const { user, logout } = useAuth();

  const calendarTasks = useLocalStorageSubscription({
    key: 'calendarTasks',
  });

  // Prevent hydration mismatch
  const mounted = useIsClient();

  const currentProjectId = useMemo(() => {
    return pathname?.split('/')[4];
  }, [pathname]);

  const taskCount = useMemo(() => {
    if (!mounted || !calendarTasks) return undefined;

    if (currentProjectId) {
      return calendarTasks.filter(
        (task: { projectId?: unknown }) => String(task.projectId) === String(currentProjectId)
      ).length;
    }

    if (workspaceId) {
      return calendarTasks.length;
    }

    return 0;
  }, [mounted, calendarTasks, currentProjectId, workspaceId]);

  const workspaceBase = workspaceId ? `/workspace/${workspaceId}` : null;

  return (
    <aside className="bg-sidebar flex min-h-[calc(100vh-61px)] w-64 shrink-0 flex-col border-r border-sidebar-border p-4">
      <WorkspaceSwitcher />

      <div className="my-4 h-px bg-sidebar-border" role="separator" />

      <nav className="flex-1" aria-label="Primary">
        <p className="mb-2 px-3 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
          Menu
        </p>
        <ul className="space-y-0.5">
          <NavLink href="/dashboard" label="Dashboard" icon={LayoutDashboard} pathname={pathname} />
          <NavLink href="/analytics" label="Analytics" icon={BarChart3} pathname={pathname} />

          {workspaceBase ? (
            <>
              <NavLink
                href={workspaceBase}
                label="Workspace"
                icon={Briefcase}
                pathname={pathname}
              />

              <NavLink
                href={`${workspaceBase}/projects`}
                label="Projects"
                icon={FolderKanban}
                pathname={pathname}
              />

              <NavLink
                href={`${workspaceBase}/tasks`}
                label="Tasks"
                icon={ListChecks}
                pathname={pathname}
                count={taskCount}
              />

              <NavLink
                href={`${workspaceBase}/teams`}
                label="Teams"
                icon={Users}
                pathname={pathname}
              />

              <NavLink
                href={`${workspaceBase}/settings`}
                label="Settings"
                icon={Settings}
                pathname={pathname}
              />
            </>
          ) : (
            <NavLink
              href="/workspace/new"
              label="Create Workspace"
              icon={PlusCircle}
              pathname={pathname}
            />
          )}
        </ul>
      </nav>

      {user && (
        <div className="border-sidebar-border bg-sidebar-accent mt-4 rounded-xl border p-3">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-primary-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold">
              {user.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>

              <p className="text-muted-foreground truncate font-mono text-[11px]">
                {user.email}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="text-muted-foreground hover:bg-sidebar hover:text-foreground mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-sidebar-border px-3 py-1.5 text-xs font-medium transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Logout
          </button>
        </div>
      )}
    </aside>
  );
}
