// components/analytics/AnalyticsDashboard.tsx

'use client';

import CompletionChart from './CompletionChart';
import VelocityChart from './VelocityChart';
import WorkloadChart from './WorkloadChart';
import type { AnalyticsData } from './types';

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="animate-enter rounded-2xl border border-border bg-card p-5 shadow-card">
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  return (
    <div className="space-y-8">
      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Tasks" value={data.totalTasks ?? 0} />
        <StatCard label="Completed" value={data.completedTasks ?? 0} />
        <StatCard label="Completion Rate" value={`${data.completionRate ?? 0}%`} />
      </div>

      <div className="flex justify-end">
        <a
          href="/api/analytics/export"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-popover"
        >
          Export CSV
        </a>
      </div>

      <section aria-labelledby="completion-heading" className="animate-enter rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6" style={{ '--i': 1 } as React.CSSProperties}>
        <h2 id="completion-heading" className="mb-1 text-base font-semibold tracking-tight">
          Completion Overview
        </h2>
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Completed vs total tasks
        </p>
        <CompletionChart data={data} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="workload-heading" className="animate-enter rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6" style={{ '--i': 2 } as React.CSSProperties}>
          <h2 id="workload-heading" className="mb-1 text-base font-semibold tracking-tight">
            Workload by Member
          </h2>
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Open vs completed per assignee
          </p>
          <WorkloadChart data={data.workload} />
        </section>
        <section aria-labelledby="velocity-heading" className="animate-enter rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6" style={{ '--i': 3 } as React.CSSProperties}>
          <h2 id="velocity-heading" className="mb-1 text-base font-semibold tracking-tight">
            Completion Velocity
          </h2>
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Tasks completed per week
          </p>
          <VelocityChart data={data.velocity} />
        </section>
      </div>
    </div>
  );
}
