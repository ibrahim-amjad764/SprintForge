// components/Task/TaskDetail.tsx

"use client";

import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

interface Props { task: any }

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
        <div className="border rounded-lg p-8">
            <div className="flex justify-between">
                <h1 className="text-3xl font-bold">
                    {task.title}
                </h1>

                <button
                    onClick={deleteTask}
                    className="bg-red-600 text-white px-4 py-2 rounded"
                > Delete
                </button>
            </div>

            <div className="mt-6 space-y-4">
                <p>
                    <strong>Description:</strong>
                    <br />
                    {task.description || "No description"}
                </p>

                <p>
                    <strong>Priority:</strong>
                    {" "}
                    {task.priority}
                </p>

                <p>
                    <strong>Status:</strong>
                </p>
                <select
                    className="border p-2" value={task.status}
                    onChange={
                        e => changeStatus(e.target.value)
                    }
                >
                    <option> TODO </option>

                    <option> IN_PROGRESS </option>

                    <option> REVIEW </option>

                    <option> COMPLETED </option>
                </select>
            </div>
        </div>

    );
}
