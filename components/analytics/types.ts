// components/analytics/types.ts

export interface AnalyticsData {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  workload: WorkloadRow[];
  velocity: VelocityRow[];
}

export interface WorkloadRow {
  userId: string | null;
  name: string;
  tasks: number;
  completed: number;
}

export interface VelocityRow {
  _id: string; // ISO week label, e.g. "2026-W42"
  completed: number;
}
