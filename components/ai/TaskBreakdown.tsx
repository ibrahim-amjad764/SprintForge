// components/ai/TaskBreakdown.tsx
'use client';

import { useState } from 'react';

export default function TaskBreakdown() {
  const [task, setTask] = useState('');
  const [result, setResult] = useState('');
  const [summary, setSummary] = useState('');
  
  async function generateTaskBreakdown() {
    const response = await fetch('/api/ai/task-breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task }),
      });

    const data = await response.json();
    setResult(data.data);
  }

  async function generateSummary() {
    const response = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: task }),
      });

    const data = await response.json();
    setSummary(data.data);
  }

  return (
    <div className="space-y-4">
      <textarea
        className="w-full border p-3 h-24 resize-none"
        placeholder="Describe task or project"
        onChange={(e) => setTask(e.target.value)}
      />

      <div className="flex gap-2">
        <button
          onClick={generateTaskBreakdown}
          className="rounded bg-black px-4 py-2 text-white"
        >
          Generate
        </button>
        <button
          onClick={generateSummary}
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Generate Summary
        </button>
      </div>
      {result && <pre className="mt-4">{result}</pre>}
      {summary && <p className="mt-4">{summary}</p>}
    </div>
  );
}
