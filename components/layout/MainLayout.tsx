// components/layout/MainLayout.tsx

"use client";

import { useState } from "react";
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

  return (
    // MainLayout is the shared chrome for every authenticated page, so it
    // is the single mount point for the realtime socket. getSocket() is a
    // module-level singleton — remounts across navigations reuse the same
    // connection, and logout does a full page unload which closes it.
    <SocketProvider>
    <div className="min-h-screen bg-background">
      <Navbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
      <Toaster position="top-right" />

      <div className="flex">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed z-50 h-full w-64 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0`}>
          <Sidebar />
        </div>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:ml-0">{children}</main>
      </div>
    </div>
    </SocketProvider>
  );
}
