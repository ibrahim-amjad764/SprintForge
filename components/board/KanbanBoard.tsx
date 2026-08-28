// components/board/KanbanBoard.tsx
'use client';

import { DragDropContext } from '@hello-pangea/dnd';
import { apiRequest } from '@/lib/api';
import { useState } from 'react';
import BoardColumn from './BoardColumn';

const columns = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'];

export default function KanbanBoard({ tasks }: { tasks: any[] }) {
  const [items, setItems] = useState(tasks);

  async function onDragEnd(result: any) {
    if (!result.destination) return;

    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId;

    // Update Database
    await apiRequest(`/api/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
    });

    // Update UI Instantly
    setItems(
      items.map((task) =>
        task._id === taskId
          ? {
              ...task,
              status: newStatus,
            }
          : task
      )
    );
  }

  function getTasks(status: string) {
    return items.filter((task) => task.status === status);
  }
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-5 overflow-x-auto">
        {columns.map((column) => (
          <BoardColumn
            key={column}
            title={column}
            tasks={getTasks(column)}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
