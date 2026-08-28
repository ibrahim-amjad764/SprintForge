// components/analytics/AnalyticsDashboard.tsx

'use client';

import CompletionChart from './CompletionChart';

import VelocityChart from './VelocityChart';

import WorkloadChart from './WorkloadChart';

export default function AnalyticsDashboard({ data }: { data: any }) {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-bold">Completion Rate</h2>

        <p>{data.completionRate}%</p>
      </div>

      <div className="grid gap-10 md:grid-cols-2">
        <CompletionChart data={data} />

        <WorkloadChart data={data.workload} />
      </div>

      <VelocityChart data={data.velocity} />
    </div>
  );
}
