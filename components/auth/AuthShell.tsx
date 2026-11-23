'use client';

import Link from 'next/link';
import { Check, Zap } from 'lucide-react';
import ThemeToggle from '@/components/theme/ThemeToggle';

const highlights = [
  'Kanban boards & sprint planning',
  'Real-time team collaboration',
  'Analytics that ship insights, not noise',
];

/*
 * Shared chrome for the public auth pages (login / register /
 * forgot-password): split-screen on desktop with a branded gradient
 * panel, single-column card on mobile. Theme toggle is mounted here so
 * auth pages respect the user's theme choice like the rest of the app.
 */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen bg-background">
      {/* Brand panel — desktop only */}
      <aside className="relative hidden w-[46%] max-w-xl flex-col justify-between overflow-hidden border-r border-border bg-card p-10 lg:flex xl:p-14">
        <div className="mesh-gradient pointer-events-none absolute inset-0" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full opacity-40 blur-3xl"
          style={{ background: 'var(--glow-primary)' }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full opacity-30 blur-3xl"
          style={{ background: 'var(--glow-accent)' }}
          aria-hidden="true"
        />

        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow">
            <Zap className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold tracking-tight">SprintForge</span>
        </Link>

        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
            Ship sprints,
            <br />
            <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
              not busywork.
            </span>
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            The project workspace built for agile teams — plan, track, and
            ship from one place.
          </p>
          <ul className="mt-8 space-y-3">
            {highlights.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-foreground/90">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative font-mono text-xs text-muted-foreground">
          SOC 2-aligned · Single sign-on ready
        </p>
      </aside>

      {/* Form column */}
      <section className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
