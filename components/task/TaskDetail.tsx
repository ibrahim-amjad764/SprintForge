// components / Task/TaskDetail.tsx

"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { ChevronLeft, Trash2 } from "lucide-react";

interface TaskLike {
  _id: string | { toString(): string };
  title: string;
  description?: string;
  status: string;
  priority: string;
}
interface Props { task: TaskLike }

const statusChip = (status: string) => {
  switch (status) {
    case 'IN_PROGRESS': return 'border-primary/25 bg-primary/10 text-primary';
    case 'REVIEW': return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case 'COMPLETED': return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    default: return 'border-border bg-muted text-muted-foreground';
  }
};

const priorityChip = (priority: string) => {
  switch (priority) {
    case 'HIGH': case 'URGENT': return 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300';
    case 'MEDIUM': return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    default: return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  }
};

export default function TaskDetail({ task }: Props) {
    const router = useRouter();

    async function deleteTask() {
        const confirmDelete = confirm("Delete this task?");

        if (!confirmDelete)
            return;

        await apiRequest(`/api/tasks/${task._id}`, { method: "DELETE" });
        router.back();
    }


    async function changeStatus(status: string) {
        await apiRequest(`/api/tasks/${task._id}`,
            {
                method: "PUT",
                body: JSON.stringify({
                    status
                })
            }
        );

        router.refresh();
    }

    return (
        <div className="mx-auto max-w-2xl">
            <Link
                href="/tasks"
                className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Back to tasks
            </Link>

            <div className="animate-enter rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                            {task.title}
                        </h1>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusChip(task.status)}`}>
                                {task.status?.replace(/_/g, ' ')}
                            </span>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${priorityChip(task.priority)}`}>
                                {task.priority} priority
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={deleteTask}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3.5 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-500/20 dark:text-red-300"
                    >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Delete
                    </button>
                </div>

                <div className="mt-6 space-y-5 border-t border-border pt-6">
                    <div>
                        <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            Description
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                            {task.description || "No description"}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <div>
                            <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                Status
                            </h2>
                            <select
                                className="mt-2 rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm transition-colors focus:border-primary/60 focus:bg-background focus:ring-2 focus:ring-primary/25 focus:outline-none"
                                value={task.status}
                                onChange={e => changeStatus(e.target.value)}
                                aria-label="Change task status"
                            >
                                <option value="TODO">To Do</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="REVIEW">Review</option>
                                <option value="COMPLETED">Completed</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
