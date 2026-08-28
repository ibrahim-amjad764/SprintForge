'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import WorkspaceSwitcher from '@/components/workspace/WorkspaceSwitcher';
import useAuth from '@/hooks/useAuth';
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
  pathname: string | null;
  count?: number;
};

function NavLink({ href, label, pathname, count }: NavLinkProps) {
  const isActive =
    pathname === href || (href !== '/dashboard' && pathname?.startsWith(href));

  return (
    <li>
      <Link
        href={href}
        className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition ${
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        <span>{label}</span>

        {typeof count === 'number' && count > 0 && (
          <span className="bg-primary-foreground/20 ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-2 py-0.5 text-xs leading-none font-medium">
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentProjectId = useMemo(() => {
    return pathname?.split('/')[4];
  }, [pathname]);

  const taskCount = useMemo(() => {
    if (!mounted || !calendarTasks) return undefined;

    if (currentProjectId) {
      return calendarTasks.filter(
        (task: any) => String(task.projectId) === String(currentProjectId)
      ).length;
    }

    if (workspaceId) {
      return calendarTasks.length;
    }

    return 0;
  }, [mounted, calendarTasks, currentProjectId, workspaceId]);

  const workspaceBase = workspaceId ? `/workspace/${workspaceId}` : null;

  return (
    <aside className="bg-sidebar flex min-h-[calc(100vh-65px)] w-64 shrink-0 flex-col border-r p-5">
      <WorkspaceSwitcher />

      <hr className="border-sidebar-border my-5" />

      <nav className="flex-1">
        <ul className="space-y-1">
          <NavLink href="/dashboard" label="Dashboard" pathname={pathname} />

          {workspaceBase ? (
            <>
              <NavLink
                href={workspaceBase}
                label="Workspace"
                pathname={pathname}
              />

              <NavLink
                href={`${workspaceBase}/projects`}
                label="Projects"
                pathname={pathname}
              />

              <NavLink
                href={`${workspaceBase}/tasks`}
                label="Tasks"
                pathname={pathname}
                count={taskCount}
              />

              <NavLink
                href={`${workspaceBase}/teams`}
                label="Teams"
                pathname={pathname}
              />

              <NavLink
                href={`${workspaceBase}/settings`}
                label="Settings"
                pathname={pathname}
              />
            </>
          ) : (
            <NavLink
              href="/workspace/new"
              label="Create Workspace"
              pathname={pathname}
            />
          )}
        </ul>
      </nav>

      {user && (
        <div className="border-sidebar-border bg-sidebar-accent mt-auto rounded-md border p-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-full font-semibold">
              {user.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>

              <p className="text-muted-foreground truncate text-xs">
                {user.email}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="border-sidebar-border text-muted-foreground hover:bg-sidebar hover:text-foreground mt-3 w-full rounded-md border px-3 py-1.5 text-xs font-medium transition"
          >
            Logout
          </button>
        </div>
      )}
    </aside>
  );
}
