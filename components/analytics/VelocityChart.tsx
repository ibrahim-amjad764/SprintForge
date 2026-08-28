// components/analytics/VelocityChart.tsx

'use client';

import { LineChart, Line, XAxis, YAxis } from 'recharts';

export default function VelocityChart({ data }: { data: any[] }) {
  return (
    <LineChart
      width={500}

      height={300}

      data={data}
    >
      <XAxis dataKey="_id" />

      <YAxis />

      <Line
        type="monotone"

        dataKey="completed"

        stroke="#16a34a"
      />
    </LineChart>
  );
}
