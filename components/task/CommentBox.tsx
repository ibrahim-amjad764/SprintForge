'use client';

import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { apiRequest } from '@/lib/api';
import useAuth from '@/hooks/useAuth';
import getSocket from '@/lib/socket-client';

export default function CommentBox({ taskId }: { taskId: string }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let socket: Socket | null = null;
    let cancelled = false;

    getSocket().then((s) => {
      if (cancelled) return;
      socket = s;
      socket.on('new-comment', (comment: unknown) => {
        console.log('New Comment', comment);
      });
    });

    return () => {
      cancelled = true;
      socket?.off('new-comment');
    };
  }, []);

  async function submit() {
    if (!user?._id) {
      setError('You must be logged in to comment');
      return;
    }

    try {
      await apiRequest('/api/comments', {
        method: 'POST',
        body: JSON.stringify({
          task: taskId,
          user: user._id,
          text,
        }),
      });

      setText('');
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    }
  }

  return (
    <div className="mt-8 space-y-3">
      <h3 className="font-semibold">Comments</h3>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <textarea
        className="w-full rounded-md border p-3"
        placeholder="Write comment"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button
        type="button"
        onClick={submit}
        disabled={!text.trim()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        Comment
      </button>
    </div>
  );
}