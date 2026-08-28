// components/ai/ProjectSummary.tsx

'use client';

import { useState } from 'react';

export default function ProjectSummary() {
  const [summary, setSummary] = useState('');

  async function generate() {
    const response = await fetch(
      '/api/ai/summary',

      {
        method: 'POST',
        body: JSON.stringify({
          project: 'SprintForge project management SaaS',
        }),
      }
    );

    const data = await response.json();
    setSummary(data.data);
  }

  return (
    <div>
      <button
        onClick={generate}
        className="rounded bg-blue-600 px-4 py-2 text-white"
      >
        Generate Summary
      </button>

      <p className="mt-5">{summary}</p>
    </div>
  );
}
