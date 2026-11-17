'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
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
  const [workspaceInfo, setWorkspaceInfo] = useState<{
    id: string;
    logo: string | null;
    name: string | null;
  } | null>(null);

  const match = pathname?.match(/^\/workspace\/([^/]+)(?:\/|$)/);
  const workspaceId = match?.[1];
  const isWorkspaceDetail = Boolean(workspaceId && workspaceId !== 'new');

  useEffect(() => {
    if (!isWorkspaceDetail || !workspaceId) return;

    let cancelled = false;
    fetch(`/api/workspace/${workspaceId}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        setWorkspaceInfo({
          id: workspaceId,
          logo: data?.success ? data.data?.logo || null : null,
          name: data?.success ? data.data?.name || null : null,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspaceInfo({ id: workspaceId, logo: null, name: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, isWorkspaceDetail]);

  const activeWorkspace =
    isWorkspaceDetail && workspaceInfo?.id === workspaceId
      ? workspaceInfo
      : null;

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
            {(() => {
              const logoSrc = activeWorkspace?.logo || '/file.svg';
              // Only http(s) raster images go through the optimizer —
              // local SVGs and data: URLs must render unoptimized.
              const optimizable =
                /^https?:\/\//.test(logoSrc) && !logoSrc.endsWith('.svg');
              return (
                <Image
                  src={logoSrc}
                  alt="Workspace logo"
                  width={40}
                  height={40}
                  priority
                  unoptimized={!optimizable}
                  className="h-10 w-10 rounded-md border border-slate-200 bg-slate-50 object-cover"
                />
              );
            })()}
            <div>
              <p className="text-lg font-semibold text-slate-900">
                SprintForge
              </p>
              {activeWorkspace?.name && (
                <p className="text-sm text-slate-500">{activeWorkspace.name}</p>
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
