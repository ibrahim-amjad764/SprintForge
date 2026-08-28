'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useAuth from '@/hooks/useAuth';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import SearchBox from '@/components/search/SearchBox';

interface NavbarProps {
  onMenuToggle?: () => void;
}

export default function Navbar({ onMenuToggle }: NavbarProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [workspaceLogo, setWorkspaceLogo] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);

  useEffect(() => {
    const match = pathname?.match(/^\/workspace\/([^/]+)(?:\/|$)/);
    const workspaceId = match?.[1];
    const isWorkspaceDetail = Boolean(workspaceId && workspaceId !== 'new');

    if (!isWorkspaceDetail) {
      setWorkspaceLogo(null);
      setWorkspaceName(null);
      return;
    }

    async function loadWorkspace() {
      try {
        const response = await fetch(`/api/workspace/${workspaceId}`);
        const data = await response.json();

        if (data?.success) {
          setWorkspaceLogo(data.data?.logo || null);
          setWorkspaceName(data.data?.name || null);
        } else {
          setWorkspaceLogo(null);
          setWorkspaceName(null);
        }
      } catch {
        setWorkspaceLogo(null);
        setWorkspaceName(null);
      }
    }

    loadWorkspace();
  }, [pathname]);

  // Hide search box on workspace creation page
  const isWorkspaceCreationPage = pathname === '/workspace/new';

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          {/* Hamburger Menu Button - Mobile Only */}
          <button
            onClick={onMenuToggle}
            className="lg:hidden rounded p-2 hover:bg-gray-100"
            aria-label="Toggle menu"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link href="/" className="flex items-center gap-3">
            <img
              src={workspaceLogo || '/file.svg'}
              alt="Workspace logo"
              className="h-10 w-10 rounded-md border border-slate-200 bg-slate-50 object-cover"
            />
            <div>
              <p className="text-lg font-semibold text-slate-900">
                SprintForge
              </p>
              {workspaceName && (
                <p className="text-sm text-slate-500">{workspaceName}</p>
              )}
            </div>
          </Link>
        </div>

        {!isWorkspaceCreationPage && (
          <div className="hidden flex-1 px-4 lg:block">
            <SearchBox />
          </div>
        )}

        <div className="flex items-center gap-3">
          {user ? (
            <NotificationDropdown userId={user._id} />
          ) : (
            <Link
              href="/login"
              className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
