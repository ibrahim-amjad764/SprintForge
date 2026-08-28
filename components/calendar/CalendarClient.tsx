// components\calendar\CalendarClient.tsx
'use client';

import { useState } from 'react';
import Calendar from './Calendar';
import { Task } from './Calendar';

interface CalendarClientProps {
  initialTasks: Task[];
}

export default function CalendarClient({ initialTasks }: CalendarClientProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const handleTaskCreated = (newTask: Task) => {
    setTasks((prev) => [...prev, newTask]);
  };

  const handleTaskUpdated = (updatedTask: Task) => {
    setTasks((prev) => prev.map((t) => (t._id === updatedTask._id ? updatedTask : t)));
  };

  const handleTaskDeleted = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t._id !== taskId));
  };

  return (
    <Calendar
      tasks={tasks}
      onTaskCreated={handleTaskCreated}
      onTaskUpdated={handleTaskUpdated}
      onTaskDeleted={handleTaskDeleted}
    />
  );
}
