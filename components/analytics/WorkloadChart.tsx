// components/analytics/WorkloadChart.tsx
'use client';

import { PieChart, Pie, Cell } from 'recharts';

export default function WorkloadChart({ data }: { data: any[] }) {
  return (
    <PieChart
      width={400}

      height={300}
    >
      <Pie
        data={data}

        dataKey="tasks"

        nameKey="_id"

        outerRadius={100}
      >
        {data.map((_, index) => (
          <Cell
            key={index}

            fill={index % 2 ? '#2563eb' : '#22c55e'}
          />
        ))}
      </Pie>
    </PieChart>
  );
}
