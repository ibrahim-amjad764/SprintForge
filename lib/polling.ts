// lib/polling.ts
//
// Framework-free polling primitives. The React hook (hooks/usePolling.ts)
// is a thin wrapper; keeping the engine here makes the timing, visibility,
// and merge semantics unit-testable in the node Jest environment.
//
// Guarantees:
// - At most one callback execution in flight (interval, focus, and
//   visibility-resume triggers can never overlap).
// - Ticks are skipped while the document is hidden; a single catch-up
//   run fires when it becomes visible again.
// - Focus/visibility triggers are debounced to avoid request storms.

export interface PollerEnvironment {
  /** Returns true when the page is hidden (no requests should fire). */
  isHidden?: () => boolean;
  now?: () => number;
  /** Focus event subscription; return an unsubscribe function. */
  onFocus?: (cb: () => void) => () => void;
  /** Visibility-change subscription; return an unsubscribe function. */
  onVisibility?: (cb: () => void) => () => void;
}

export interface PollerOptions extends PollerEnvironment {
  intervalMs: number;
  /** Refresh immediately on window focus (default true). */
  refreshOnFocus?: boolean;
  /** Minimum ms between focus-triggered runs (default 2000). */
  focusDebounceMs?: number;
}

export interface Poller {
  /** Idempotent — calling twice returns the same stop function effect. */
  start: () => () => void;
  /** Manual trigger; subject to the same hidden/in-flight guards. */
  run: () => void;
  isInFlight: () => boolean;
}

export function createPoller(
  callback: () => void | Promise<void>,
  options: PollerOptions,
): Poller {
  const {
    intervalMs,
    isHidden = () =>
      typeof document !== 'undefined' && document.hidden === true,
    now = () => Date.now(),
    onFocus,
    onVisibility,
    refreshOnFocus = true,
    focusDebounceMs = 2000,
  } = options;

  let inFlight = false;
  // -Infinity so the FIRST focus event always fires (0 would debounce it).
  let lastFocusAt = Number.NEGATIVE_INFINITY;
  let running = false;

  const run = () => {
    if (isHidden() || inFlight) return;
    inFlight = true;
    Promise.resolve()
      .then(() => callback())
      .catch(() => {
        // Polling must never surface unhandled rejections — callers
        // handle their own errors; a failed poll simply retries next tick.
      })
      .finally(() => {
        inFlight = false;
      });
  };

  const start = (): (() => void) => {
    if (running || intervalMs <= 0) return () => {};
    running = true;

    const timer = setInterval(run, intervalMs);
    const unsubscribers: Array<() => void> = [];

    if (onVisibility) {
      unsubscribers.push(
        onVisibility(() => {
          // Catch-up run when the tab becomes visible again.
          if (!isHidden()) run();
        }),
      );
    }

    if (refreshOnFocus && onFocus) {
      unsubscribers.push(
        onFocus(() => {
          const t = now();
          if (t - lastFocusAt < focusDebounceMs) return;
          lastFocusAt = t;
          run();
        }),
      );
    }

    return () => {
      running = false;
      clearInterval(timer);
      for (const off of unsubscribers) off();
    };
  };

  return { start, run, isInFlight: () => inFlight };
}

/* ------------------------------------------------------------------ */
/* Merge helpers — _id-keyed, order-preserving                          */
/* ------------------------------------------------------------------ */

/** Dedupe by `_id`, keeping the LAST occurrence of each id. */
export function dedupeById<T extends { _id?: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  const result: T[] = [];
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item._id && seen.has(item._id)) continue;
    if (item._id) seen.set(item._id, item);
    result.unshift(item);
  }
  return result;
}

/**
 * Recency merge for poll-vs-socket races: for each fetched item, keep
 * the PREVIOUS version when its `updatedAt` is strictly newer (e.g. a
 * socket `task:updated` landed while the poll request was in flight).
 * Items absent from `fetched` are untouched — callers decide whether
 * absence means deletion.
 */
export function pickNewerByTimestamp<
  T extends { _id?: string; updatedAt?: string | Date },
>(prev: T[], fetched: T[]): T[] {
  const prevMap = new Map<string, T>();
  for (const item of prev) {
    if (item._id) prevMap.set(item._id, item);
  }
  return fetched.map((item) => {
    const old = item._id ? prevMap.get(item._id) : undefined;
    if (!old) return item;
    const oldTime = Date.parse(String(old.updatedAt ?? ''));
    const newTime = Date.parse(String(item.updatedAt ?? ''));
    // Unparseable timestamps → trust the fetched (server) version.
    if (Number.isNaN(oldTime) || Number.isNaN(newTime)) return item;
    return oldTime > newTime ? old : item;
  });
}

/**
 * Partial-scope merge: update existing items in place, append fetched
 * items that are new. Used when only SOME poll endpoints succeeded —
 * tasks in failed scopes are never removed, so a transient API failure
 * cannot make data disappear.
 */
export function mergePartialById<T extends { _id?: string }>(
  prev: T[],
  fetched: T[],
): T[] {
  const byId = new Map<string, T>();
  for (const item of fetched) {
    if (item._id) byId.set(item._id, item);
  }
  const known = new Set(prev.map((t) => t._id).filter(Boolean));
  const merged = prev.map((t) => (t._id ? byId.get(t._id) ?? t : t));
  const added = fetched.filter((t) => t._id && !known.has(t._id));
  return [...added, ...merged];
}
