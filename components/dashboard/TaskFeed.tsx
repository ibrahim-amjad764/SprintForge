"use client";

import { useEffect, useState } from "react";
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadTasks() {
    // Intercept call if no workspace is active/selected yet
    if (!workspaceId) {
      setTasks([]);
      return;
    }

    setLoading(true);
    try {
      // Direct integration matching your active workspace state
      const url = `/api/tasks?workspace=${workspaceId}`;
      const response = await apiRequest(url);
      setTasks(response.data || []);
    } catch (error) {
      console.error("Failed to load tasks:", error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, [workspaceId]);


  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800";
      case "REVIEW":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "text-red-600";
      case "HIGH":
        return "text-orange-600";
      case "MEDIUM":
        return "text-yellow-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="rounded border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold">Recent Tasks</h2>
        <button
          onClick={loadTasks}
          className="rounded px-3 py-1 text-sm text-blue-600 hover:bg-blue-50"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500"></div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-8 text-center text-gray-500">
          No tasks found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="pb-3 text-left font-medium">Task</th>
                <th className="pb-3 text-left font-medium">Project</th>
                <th className="pb-3 text-left font-medium">Status</th>
                <th className="pb-3 text-left font-medium">Priority</th>
                <th className="pb-3 text-left font-medium">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {tasks.slice(0, 10).map((task) => (
                <tr key={task._id} className="border-b hover:bg-gray-50">
                  <td className="py-3 font-medium">{task.title}</td>
                  <td className="py-3 text-gray-600">{task.project?.name || "-"}</td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(
                        task.status
                      )}`}
                    >
                      {task.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className={`py-3 font-medium ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </td>
                  <td className="py-3 text-gray-600">
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
