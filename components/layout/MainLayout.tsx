// components/layout/MainLayout.tsx

"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import { Toaster } from "react-hot-toast";
import SocketProvider from "@/components/realtime/SocketProvider";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer on navigation so it never covers content.
  // Render-phase state adjustment (React-endorsed alternative to an effect).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setSidebarOpen(false);
  }

  return (
    // MainLayout is the shared chrome for every authenticated page, so it
    // is the single mount point for the realtime socket. getSocket() is a
    // module-level singleton — remounts across navigations reuse the same
    // connection, and logout does a full page unload which closes it.
    <SocketProvider>
    <div className="min-h-screen bg-background">
      <Navbar
        sidebarOpen={sidebarOpen}
        onMenuToggle={() => setSidebarOpen((open) => !open)}
      />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'color-mix(in oklch, var(--popover) 88%, transparent)',
            color: 'var(--popover-foreground)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-popover)',
            backdropFilter: 'blur(12px)',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: 'var(--success)', secondary: 'var(--popover)' } },
          error: { iconTheme: { primary: 'var(--destructive)', secondary: 'var(--popover)' } },
        }}
      />

      <div className="flex">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <div
          className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:relative lg:translate-x-0`}
        >
          <Sidebar />
        </div>

        {/* Main Content */}
        <main className="page-enter min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
    </SocketProvider>
  );
}
