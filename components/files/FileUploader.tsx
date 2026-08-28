// components/files/FileUploader.tsx
'use client';

import { useState } from 'react';

export default function FileUploader() {
  const [file, setFile] = useState<any>();

  async function upload() {
    const data = new FormData();

    data.append(
      'file',
      file
    );

    await fetch(
      '/api/files/upload',

      {
        method: 'POST',
        body: data,
      }
    );

    alert('Uploaded');
  }

  return (
    <div>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0])}
      />

      <button
        onClick={upload}
        className="rounded bg-black px-4 py-2 text-white"
      >
        Upload
      </button>
    </div>
  );
}
