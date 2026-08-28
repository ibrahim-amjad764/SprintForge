// components/task/TaskList.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import TaskCard from "./TaskCard";
import useSocket from "@/hooks/useSocket";

// 1. Senior Step: 'any' ko hata kar proper interface banayen
interface TaskType {
  _id: string;
  title: string;
  status: string;
  priority: string;
  description?: string;
  createdAt?: string;
  assignee?: any; // aap yahan apna User type bhi de sakte hain
  [key: string]: any; // agar kuch extra fields aaye toh error na aaye
}

type FilterType = 'all' | 'high' | 'medium' | 'low' | 'completed' | 'pending';

export default function TaskList({
  tasks: initialTasks,
  taskHrefPrefix,
  workspaceId,
  projectId,
  projects,
  teamMembers,
}: {
  tasks: TaskType[];
  taskHrefPrefix?: string;
  workspaceId?: string;
  projectId?: string;
  projects?: any[];
  teamMembers?: any[];
}) {
  console.log("=== TASK LIST COMPONENT INITIALIZED ===");
  console.log("Props received:", { 
    taskCount: initialTasks.length, 
    workspaceId, 
    projectId,
    projectsCount: projects?.length,
    teamMembersCount: teamMembers?.length 
  });
  
  const socket = useSocket();

  // 2. Local state banaya jo initially props se load hoga
  const [tasks, setTasks] = useState<TaskType[]>(initialTasks);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletedTask, setDeletedTask] = useState<TaskType | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle task prepend from form
  const handleTaskCreated = (newTask: TaskType) => {
    setTasks((prevTasks) => [newTask, ...prevTasks]);
  };

  // Move task up/down
  const moveTask = (taskId: string, direction: 'up' | 'down') => {
    setTasks((prevTasks) => {
      const index = prevTasks.findIndex((t) => t._id === taskId);
      if (index === -1) return prevTasks;

      const newTasks = [...prevTasks];
      const newIndex = direction === 'up' ? index - 1 : index + 1;

      if (newIndex < 0 || newIndex >= newTasks.length) return prevTasks;

      // Swap tasks
      [newTasks[index], newTasks[newIndex]] = [newTasks[newIndex], newTasks[index]];
      return newTasks;
    });
  };

  // Handle task delete with undo
  const handleTaskDeleted = (taskId: string) => {
    const taskToDelete = tasks.find((t) => t._id === taskId);
    if (!taskToDelete) return;

    // Store deleted task for undo
    setDeletedTask(taskToDelete);
    setShowUndo(true);

    // Remove from list
    setTasks((prev) => prev.filter((t) => t._id !== taskId));

    // Clear previous timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }

    // Auto-hide undo after 5 seconds
    undoTimeoutRef.current = setTimeout(() => {
      setShowUndo(false);
      setDeletedTask(null);
    }, 5000);
  };

  // Undo delete
  const handleUndo = () => {
    if (deletedTask) {
      setTasks((prev) => [deletedTask, ...prev]);
      setDeletedTask(null);
      setShowUndo(false);
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedTasks.size === 0) return;

    if (!confirm(`Delete ${selectedTasks.size} task(s)?`)) return;

    // Optimistic update
    setTasks((prev) => prev.filter((t) => !selectedTasks.has(t._id)));
    setSelectedTasks(new Set());
    setBulkMode(false);

    // API calls would go here
    console.log('Bulk delete:', Array.from(selectedTasks));
  };

  // Toggle bulk selection
  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  // Highlight search text
  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  };

  useEffect(() => {
    // Agar socket connect nahi hua hai toh kuch mat karo
    if (!socket) return;

    // 3. Backend ne jo naya format bheja tha { event, data }, usko handle karna
    const handleTaskUpdated = (payload: { event: string; data: TaskType }) => {
      console.log("Task Updated via Socket:", payload.data);
      
      setTasks((prevTasks) =>
        // Map karke woh specific task replace kardo jiska update aaya hai
        prevTasks.map((task) => 
          task._id === payload.data._id ? payload.data : task
        )
      );
    };

    // 4. Backend mein delete event bhi add kiya tha, usko handle karna
    const handleTaskDeleted = (payload: { event: string; data: { _id: string } }) => {
      console.log("Task Deleted via Socket:", payload.data._id);
      
      setTasks((prevTasks) =>
        // Filter karke woh task nikal do jo delete hua hai
        prevTasks.filter((task) => task._id !== payload.data._id)
      );
    };

    // Event Listeners lagao
    // Note: Backend ne "task:updated" likha tha, isliye yahi use kar rahe hain
    socket.on("task:updated", handleTaskUpdated);
    socket.on("task:deleted", handleTaskDeleted);

    // Cleanup function (memory leak rokhne ke liye)
    return () => {
      socket.off("task:updated", handleTaskUpdated);
      socket.off("task:deleted", handleTaskDeleted);
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, [socket]); // socket dependancy add ki hai

  // Filter tasks based on selected filter
  const filteredTasks = tasks.filter((task) => {
    const statusMatch =
      filter === 'all' ||
      (filter === 'high' && task.priority === 'HIGH') ||
      (filter === 'medium' && task.priority === 'MEDIUM') ||
      (filter === 'low' && task.priority === 'LOW') ||
      (filter === 'completed' && task.status === 'COMPLETED') ||
      (filter === 'pending' && task.status !== 'COMPLETED');

    const searchMatch =
      searchQuery === '' ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase());

    return statusMatch && searchMatch;
  });

  // Calculate counts for badges
  const allCount = tasks.length;
  const highCount = tasks.filter((t) => t.priority === 'HIGH').length;
  const mediumCount = tasks.filter((t) => t.priority === 'MEDIUM').length;
  const lowCount = tasks.filter((t) => t.priority === 'LOW').length;
  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const pendingCount = tasks.filter((t) => t.status !== 'COMPLETED').length;

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="rounded-xl border bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {(['all', 'high', 'medium', 'low', 'completed', 'pending'] as FilterType[]).map(
            (filterType) => {
              const count =
                filterType === 'all'
                  ? allCount
                  : filterType === 'high'
                    ? highCount
                    : filterType === 'medium'
                      ? mediumCount
                      : filterType === 'low'
                        ? lowCount
                        : filterType === 'completed'
                          ? completedCount
                          : pendingCount;
              return (
                <button
                  key={filterType}
                  onClick={() => setFilter(filterType)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    filter === filterType
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      filter === filterType
                        ? 'bg-blue-700 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <input
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-gray-300 py-2 px-4 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      {/* Bulk Actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          Tasks ({filteredTasks.length})
        </h2>
        <button
          onClick={() => {
            setBulkMode(!bulkMode);
            setSelectedTasks(new Set());
          }}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {bulkMode ? 'Exit Bulk Mode' : 'Bulk Select'}
        </button>
      </div>

      {/* Bulk Delete Button */}
      {bulkMode && selectedTasks.size > 0 && (
        <div className="flex items-center gap-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <span className="text-sm text-red-800">
            {selectedTasks.size} task(s) selected
          </span>
          <button
            onClick={handleBulkDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
          >
            Delete Selected
          </button>
        </div>
      )}

      {/* Undo Bar */}
      {showUndo && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
          <span className="text-sm text-blue-800">
            Task deleted. Undo?
          </span>
          <button
            onClick={handleUndo}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Undo
          </button>
        </div>
      )}

      {/* Task List */}
      <div className="grid gap-4">
        {filteredTasks.map((task, index) => (
          <TaskCard
            id={task._id}
            key={task._id}
            title={task.title}
            status={task.status}
            priority={task.priority}
            description={task.description}
            createdAt={task.createdAt}
            href={taskHrefPrefix ? `${taskHrefPrefix}/${task._id}` : undefined}
            onTaskDeleted={handleTaskDeleted}
            onTaskUpdated={(updatedTask) => setTasks((prev) => prev.map((t) => t._id === updatedTask._id ? updatedTask : t))}
            onMoveUp={(id) => moveTask(id, 'up')}
            onMoveDown={(id) => moveTask(id, 'down')}
            isFirst={index === 0}
            isLast={index === filteredTasks.length - 1}
            bulkMode={bulkMode}
            selected={selectedTasks.has(task._id)}
            onToggleSelect={() => toggleTaskSelection(task._id)}
            searchQuery={searchQuery}
          />
        ))}
      </div>
    </div>
  );
}

// Export the handler for parent component
// export { handleTaskCreated };

// import React from "react";

// // Define types for a task and props
// interface Task {
//   id: number;
//   title: string;
//   description: string;
//   status: string;
//   priority: string;
//   dueDate: string;
// }

// interface TaskListProps {
//   tasks: Task[];
//   onTaskEdit: (taskId: number) => void;
//   onTaskDelete: (taskId: number) => void;
// }

// const TaskList: React.FC<TaskListProps> = ({
//   tasks,
//   onTaskEdit,
//   onTaskDelete,
// }) => {
//   return (
//     <div className="container mx-auto p-6">
//       <h1 className="text-3xl mb-6">Task List</h1>
//       {tasks.length === 0 ? (
//         <p>No tasks available.</p>
//       ) : (
//         <ul className="space-y-4">
//           {tasks.map((task) => (
//             <li key={task.id} className="p-4 bg-white rounded-lg shadow-md">
//               <h2 className="text-xl font-bold">{task.title}</h2>
//               <p>{task.description}</p>
//               <p>Status: {task.status}</p>
//               <p>Priority: {task.priority}</p>
//               <p>Due Date: {task.dueDate}</p>
//               <div className="mt-4 space-x-2">
//                 <button
//                   className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
//                   onClick={() => onTaskEdit(task.id)}
//                 >
//                   Edit
//                 </button>
//                 <button
//                   className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
//                   onClick={() => onTaskDelete(task.id)}
//                 >
//                   Delete
//                 </button>
//               </div>
//             </li>
//           ))}
//         </ul>
//       )}
//     </div>
//   );
// };

// export default TaskList;
