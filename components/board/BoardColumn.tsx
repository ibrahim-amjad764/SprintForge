// components/board/BoardColumn.tsx
'use client';

import { Droppable } from '@hello-pangea/dnd';
import BoardTaskCard from './BoardTaskCard';

interface Props {
  title: string;
  tasks: any[];
}

export default function BoardColumn({ title, tasks }: Props) {
  return (
    <div className="w-72 rounded bg-gray-100 p-4">
      <h2 className="mb-4 font-bold">{title}</h2>

      <Droppable droppableId={title}>
        {(provided) => (
          <div
            ref={provided.innerRef}

            {...provided.droppableProps}

            className="min-h-[200px]"
          >
            {tasks.map((task, index) => (
              <BoardTaskCard
                key={task._id}
                task={task}
                index={index}
              />
            ))}

            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
