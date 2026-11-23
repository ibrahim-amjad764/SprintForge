// components/analytics/WorkloadChart.tsx
'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

import type { WorkloadRow } from './types';

const PALETTE = [
  '#6366f1', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4',
  '#ef4444', '#eab308', '#4f46e5', '#ec4899', '#84cc16',
  '#7c3aed', '#14b8a6', '#f43f5e', '#a16207', '#3b82f6',
  '#22c55e', '#d946ef', '#b45309', '#6366f1', '#059669', '#be123c',
];

const tooltipStyle = {
  backgroundColor: 'var(--popover)',
  color: 'var(--popover-foreground)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  boxShadow: 'var(--shadow-popover)',
  fontSize: '12px',
};

export default function WorkloadChart({ data }: { data: WorkloadRow[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        No tasks assigned yet.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.name || 'Unassigned',
    tasks: d.tasks,
    completed: d.completed,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="tasks"
            nameKey="name"
            outerRadius="75%"
            innerRadius="45%"
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
          >
            {chartData.map((_, index) => (
              <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name, item) => {
              const raw = item as unknown as
                | { payload?: WorkloadRow }
                | WorkloadRow
                | undefined;
              const entry =
                raw && 'payload' in raw && raw.payload ? raw.payload : raw;
              const completed = (entry as WorkloadRow | undefined)?.completed ?? 0;
              return [`${value} tasks (${completed} completed)`, name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
