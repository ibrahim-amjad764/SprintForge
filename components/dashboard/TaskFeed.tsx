"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { apiRequest } from "@/lib/api";

interface Task {
  _id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  project: {
    name: string;
  };
}

export default function TaskFeed({ workspaceId }: { workspaceId?: string }) {
  const [refreshTick, setRefreshTick] = useState(0);
  const fetchKey = workspaceId ? `${workspaceId}:${refreshTick}` : null;
  const [result, setResult] = useState<{ key: string; tasks: Task[] } | null>(
    null
  );

  const tasks = result?.key === fetchKey ? result.tasks : [];
  const loading = fetchKey !== null && result?.key !== fetchKey;

  useEffect(() => {
    if (!fetchKey || !workspaceId) return;

    let cancelled = false;
    // Paginated: fetch only the 10 most recent tasks instead of
    // the entire workspace collection.
    apiRequest(`/api/tasks?workspace=${workspaceId}&page=1&limit=10`)
      .then((response) => {
        if (!cancelled) {
          setResult({ key: fetchKey, tasks: response.data?.items || [] });
        }
      })
      .catch((error) => {
        console.error("Failed to load tasks:", error);
        if (!cancelled) {
          setResult({ key: fetchKey, tasks: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchKey, workspaceId]);


  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-300";
      case "IN_PROGRESS":
        return "bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300";
      case "REVIEW":
        return "bg-yellow-100 dark:bg-yellow-500/15 text-yellow-800 dark:text-yellow-300";
      default:
        return "bg-muted text-foreground";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "text-red-600 dark:text-red-300";
      case "HIGH":
        return "text-orange-600 dark:text-orange-300";
      case "MEDIUM":
        return "text-yellow-600 dark:text-yellow-300";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="animate-enter rounded-2xl border border-border bg-card p-5 shadow-card" style={{ '--i': 3 } as React.CSSProperties}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold tracking-tight">Recent Tasks</h2>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">LATEST 10</p>
        </div>
        <button
          onClick={() => setRefreshTick((tick) => tick + 1)}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading tasks">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-shimmer h-11 rounded-lg bg-muted" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No tasks found
        </div>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 pl-2 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Task</th>
                <th className="pb-3 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Project</th>
                <th className="pb-3 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="pb-3 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Priority</th>
                <th className="pb-3 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Due</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task._id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                  <td className="py-3 pl-2 font-medium">{task.title}</td>
                  <td className="py-3 text-muted-foreground">{task.project?.name || "-"}</td>
                  <td className="py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(
                        task.status
                      )}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                      {task.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className={`py-3 font-medium ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </td>
                  <td className="py-3 font-mono text-xs text-muted-foreground">
                    {task.dueDate
                      ? new Date(task.dueDate).toLocaleDateString()
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
