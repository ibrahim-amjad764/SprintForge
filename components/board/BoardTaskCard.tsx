// components/board/BoardTaskCard.tsx
'use client';

import { Draggable } from '@hello-pangea/dnd';

interface Props {
  task: any;
  index: number;
}

export default function BoardTaskCard({ task, index }: Props) {
  return (
    <Draggable
      draggableId={task._id}

      index={index}
    >
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="mb-3 rounded border bg-white p-3 shadow-sm"
        >
          <h3 className="font-semibold">{task.title}</h3>

          <p className="text-sm text-gray-500">{task.priority}</p>
        </div>
      )}
    </Draggable>
  );
}
