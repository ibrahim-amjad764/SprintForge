// components/dashboard/TaskChart.tsx

'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export default function TaskChart({ stats }: { stats: any }) {
  const data = [
    {
      name: 'Completed',
      value: stats.completed,
    },
    {
      name: 'Pending',
      value: stats.pending,
    },
  ];

  const colors = ['#22c55e', '#ef4444'];

  // Check if there's no data
  const hasNoData = stats.completed === 0 && stats.pending === 0;

  if (hasNoData) {
    return (
      <div className="flex h-[300px] w-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-2 h-32 w-32 rounded-full bg-gray-200"></div>
          <p className="text-sm text-gray-500">No task data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      <div className="h-[250px] w-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={40}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-in-out"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={index} 
                  fill={colors[index]}
                  strokeWidth={2}
                  stroke="#fff"
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #ccc',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
              formatter={(value: any) => [value, 'Tasks']}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500"></div>
          <span className="text-sm font-medium">🔴 Pending ({stats.pending})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-green-500"></div>
          <span className="text-sm font-medium">🟢 Completed ({stats.completed})</span>
        </div>
      </div>
    </div>
  );
}