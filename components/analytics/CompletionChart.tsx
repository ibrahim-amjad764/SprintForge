// components/analytics/CompletionChart.tsx
'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export default function CompletionChart({ data }: { data: any }) {
  const chart = [
    {
      name: 'Completed',

      value: data.completedTasks,
    },

    {
      name: 'Total',

      value: data.totalTasks,
    },
  ];

  return (
    <BarChart
      width={400}

      height={300}

      data={chart}
    >
      <XAxis dataKey="name" />

      <YAxis />

      <Tooltip />

      <Bar
        dataKey="value"

        fill="#2563eb"
      />
    </BarChart>
  );
}
