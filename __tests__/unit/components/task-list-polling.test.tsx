// __tests__/unit/components/task-list-polling.test.tsx
//
// SSR smoke tests (node env — effects don't run). Verify TaskList
// accepts the pollUrls prop and renders its initial task set; the
// polling engine itself is covered by __tests__/unit/lib/polling.test.ts.

import { describe, it, expect } from '@jest/globals';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import TaskList from '@/components/task/TaskList';

const tasks = [
  { _id: 't1', title: 'Alpha task', status: 'TODO', priority: 'HIGH' },
  { _id: 't2', title: 'Beta task', status: 'DONE', priority: 'LOW' },
];

describe('TaskList polling prop', () => {
  it('renders initial tasks without pollUrls (socket-only mode)', () => {
    const html = renderToStaticMarkup(
      createElement(TaskList, { tasks }),
    );
    expect(html).toContain('Alpha task');
    expect(html).toContain('Beta task');
  });

  it('renders initial tasks with pollUrls (REST polling mode)', () => {
    const html = renderToStaticMarkup(
      createElement(TaskList, {
        tasks,
        pollUrls: ['/api/tasks?project=proj-1'],
      }),
    );
    expect(html).toContain('Alpha task');
    expect(html).toContain('Tasks');
  });
});
