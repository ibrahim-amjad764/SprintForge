'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Zap } from 'lucide-react';
import useAuth from '@/hooks/useAuth';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import SearchBox from '@/components/search/SearchBox';
import ThemeToggle from '@/components/theme/ThemeToggle';

interface NavbarProps {
  onMenuToggle?: () => void;
  sidebarOpen?: boolean;
}

export default function Navbar({ onMenuToggle, sidebarOpen = false }: NavbarProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [workspaceInfo, setWorkspaceInfo] = useState<{
    id: string;
    logo: string | null;
    name: string | null;
  } | null>(null);

  const match = pathname?.match(/^\/workspace\/([^/]+)(?:\/|$)/);
  const workspaceId = match?.[1];
  const isWorkspaceDetail = Boolean(workspaceId && workspaceId !== 'new');

  // Scroll-aware border — navbar gains a hairline once content scrolls under it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    <nav
      className={`sticky top-0 z-40 border-b bg-card/80 backdrop-blur-md transition-shadow duration-200 ${
        scrolled ? 'border-border shadow-card' : 'border-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {/* Hamburger Menu Button - Mobile Only */}
          <button
            onClick={onMenuToggle}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring lg:hidden"
            aria-label="Toggle menu"
            aria-expanded={sidebarOpen}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <Link href="/" className="flex min-w-0 items-center gap-3">
            {(() => {
              const logoSrc = activeWorkspace?.logo || null;
              // Only http(s) raster images go through the optimizer —
              // local SVGs and data: URLs must render unoptimized.
              const optimizable =
                logoSrc && /^https?:\/\//.test(logoSrc) && !logoSrc.endsWith('.svg');
              return logoSrc ? (
                <Image
                  src={logoSrc}
                  alt=""
                  width={36}
                  height={36}
                  priority
                  unoptimized={!optimizable}
                  className="h-9 w-9 shrink-0 rounded-lg border border-border bg-muted object-cover"
                />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Zap className="h-4 w-4" aria-hidden="true" />
                </span>
              );
            })()}
            <div className="min-w-0">
              <p className="truncate text-base font-bold tracking-tight text-foreground">
                SprintForge
              </p>
              {activeWorkspace?.name && (
                <p className="truncate text-xs text-muted-foreground">{activeWorkspace.name}</p>
              )}
            </div>
          </Link>
        </div>

        {!isWorkspaceCreationPage && (
          <div className="hidden flex-1 px-4 lg:block">
            <SearchBox />
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          {user ? (
            <NotificationDropdown userId={user._id} />
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-glow transition-all hover:brightness-110"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
