// components/task/LazyKanbanBoard.tsx
//
// Client boundary for next/dynamic — `ssr: false` is not allowed
// inside Server Components, so the dynamic() call lives here.
// Defers the Kanban board chunk (board + task modals) until needed.

'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type KanbanBoardType from './KanbanBoard';

type KanbanBoardProps = ComponentProps<typeof KanbanBoardType>;

const KanbanBoard = dynamic(() => import('./KanbanBoard'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[600px] w-full items-center justify-center rounded border bg-gray-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
    </div>
  ),
});

export default function LazyKanbanBoard(props: KanbanBoardProps) {
  return <KanbanBoard {...props} />;
}
