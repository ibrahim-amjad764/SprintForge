// components/task/FileUploader.tsx

'use client';

import { useState } from 'react';

export default function FileUploader({ taskId }: { taskId: string }) {
  const [file, setFile] = useState<File | null>(null);

  async function upload() {
    if (!file) return;

    const form = new FormData();

    form.append('file', file);

    form.append('task', taskId);

    await fetch('/api/attachments', {
      method: 'POST',
      body: form,
    });

    alert('Uploaded');
  }

  return (
    <div className="space-y-3">
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <button
        onClick={upload}
        className="rounded bg-black px-4 py-2 text-white"
      >
        {' '}
        Upload
      </button>
    </div>
  );
}
