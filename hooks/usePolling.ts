// hooks/usePolling.ts
'use client';

import { useEffect, useRef } from 'react';
import { createPoller } from '@/lib/polling';

interface UsePollingOptions {
  /** Set false to suspend polling entirely (default true). */
  enabled?: boolean;
  /** Refresh on window focus (default true). */
  refreshOnFocus?: boolean;
}

/**
 * Periodic + focus/visibility-aware callback.
 *
 * - Skips ticks while the tab is hidden; catches up once on return.
 * - At most one invocation in flight — interval, focus, and
 *   visibility triggers can never produce concurrent duplicate calls.
 * - Focus triggers are debounced (2s) inside createPoller.
 * - The latest callback is always used (stored in a ref), so callers
 *   can pass inline closures without re-subscribing.
 */
export default function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  options?: UsePollingOptions,
) {
  const { enabled = true, refreshOnFocus = true } = options ?? {};
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    const poller = createPoller(() => callbackRef.current(), {
      intervalMs,
      refreshOnFocus,
      onFocus: (cb) => {
        window.addEventListener('focus', cb);
        return () => window.removeEventListener('focus', cb);
      },
      onVisibility: (cb) => {
        document.addEventListener('visibilitychange', cb);
        return () => document.removeEventListener('visibilitychange', cb);
      },
    });

    return poller.start();
  }, [intervalMs, enabled, refreshOnFocus]);
}
