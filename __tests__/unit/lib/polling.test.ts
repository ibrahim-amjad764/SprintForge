// __tests__/unit/lib/polling.test.ts
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  createPoller,
  dedupeById,
  mergePartialById,
  pickNewerByTimestamp,
} from '@/lib/polling';

// advanceTimersByTimeAsync runs due timers AND flushes the microtask
// queue, so the poller's Promise.resolve().then(callback) chain settles.
const tick = (ms: number) => jest.advanceTimersByTimeAsync(ms);
const flush = () => jest.advanceTimersByTimeAsync(0);

describe('createPoller', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('runs the callback on each interval tick', async () => {
    const cb = jest.fn();
    const poller = createPoller(cb, { intervalMs: 1000, isHidden: () => false });
    const stop = poller.start();

    await tick(1000);
    expect(cb).toHaveBeenCalledTimes(1);

    await tick(2000);
    expect(cb).toHaveBeenCalledTimes(3);
    stop();
  });

  it('skips ticks while hidden and can still run via manual trigger', async () => {
    let hidden = true;
    const cb = jest.fn();
    const poller = createPoller(cb, {
      intervalMs: 1000,
      isHidden: () => hidden,
    });
    const stop = poller.start();

    await tick(3000);
    expect(cb).not.toHaveBeenCalled();

    hidden = false;
    poller.run();
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    stop();
  });

  it('never runs concurrent callbacks — in-flight guard', async () => {
    let resolveFn: (() => void) | null = null;
    const cb = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFn = resolve;
        }),
    );
    const poller = createPoller(cb, { intervalMs: 1000, isHidden: () => false });
    const stop = poller.start();

    await tick(1000);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(poller.isInFlight()).toBe(true);

    // Interval + manual trigger while in-flight: no second call.
    await tick(2000);
    poller.run();
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);

    resolveFn!();
    await flush();
    expect(poller.isInFlight()).toBe(false);

    await tick(1000);
    expect(cb).toHaveBeenCalledTimes(2);
    stop();
  });

  it('debounces focus triggers', async () => {
    let focusListener: (() => void) | null = null;
    let t = 0;
    const cb = jest.fn();
    const poller = createPoller(cb, {
      intervalMs: 60_000,
      isHidden: () => false,
      now: () => t,
      onFocus: (listener) => {
        focusListener = listener;
        return () => {};
      },
    });
    const stop = poller.start();

    focusListener!();
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);

    // Within debounce window — ignored.
    t = 1000;
    focusListener!();
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);

    // After debounce window — fires again.
    t = 3000;
    focusListener!();
    await flush();
    expect(cb).toHaveBeenCalledTimes(2);
    stop();
  });

  it('does not subscribe to focus when refreshOnFocus is false', () => {
    const onFocus = jest.fn(() => () => {});
    const cb = jest.fn();
    const poller = createPoller(cb, {
      intervalMs: 1000,
      isHidden: () => false,
      refreshOnFocus: false,
      onFocus,
    });
    const stop = poller.start();
    expect(onFocus).not.toHaveBeenCalled();
    stop();
  });

  it('stop() clears the interval and unsubscribes', async () => {
    const cb = jest.fn();
    const off = jest.fn();
    const poller = createPoller(cb, {
      intervalMs: 1000,
      isHidden: () => false,
      onVisibility: () => off,
    });
    const stop = poller.start();
    stop();

    await tick(5000);
    expect(cb).not.toHaveBeenCalled();
    expect(off).toHaveBeenCalled();
  });

  it('swallows callback rejections without killing the poller', async () => {
    const cb = jest
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(undefined);
    const poller = createPoller(cb, { intervalMs: 1000, isHidden: () => false });
    const stop = poller.start();

    await tick(1000);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(poller.isInFlight()).toBe(false);

    await tick(1000);
    expect(cb).toHaveBeenCalledTimes(2);
    stop();
  });
});

describe('dedupeById', () => {
  it('keeps the last occurrence of each _id, preserving order', () => {
    const items = [
      { _id: 'a', v: 1 },
      { _id: 'b', v: 2 },
      { _id: 'a', v: 3 },
    ];
    expect(dedupeById(items)).toEqual([
      { _id: 'b', v: 2 },
      { _id: 'a', v: 3 },
    ]);
  });

  it('handles items without _id', () => {
    const items = [{ v: 1 }, { _id: 'x', v: 2 }, { v: 3 }];
    expect(dedupeById(items)).toHaveLength(3);
  });
});

describe('mergePartialById', () => {
  it('updates fetched items in place and appends new ones', () => {
    const prev = [
      { _id: 'a', status: 'TODO' },
      { _id: 'b', status: 'DONE' },
    ];
    const fetched = [
      { _id: 'a', status: 'DONE' },
      { _id: 'c', status: 'TODO' },
    ];
    expect(mergePartialById(prev, fetched)).toEqual([
      { _id: 'c', status: 'TODO' },
      { _id: 'a', status: 'DONE' },
      { _id: 'b', status: 'DONE' },
    ]);
  });

  it('never removes prev items missing from fetched (failed scope)', () => {
    const prev = [
      { _id: 'a' },
      { _id: 'b' },
    ];
    const fetched = [{ _id: 'a' }];
    const merged = mergePartialById(prev, fetched);
    expect(merged.map((t) => t._id).sort()).toEqual(['a', 'b']);
  });
});

describe('pickNewerByTimestamp', () => {
  it('keeps the prev version when it is newer (socket beat the poll)', () => {
    const prev = [{ _id: 'a', status: 'DONE', updatedAt: '2026-01-02T00:00:00Z' }];
    const fetched = [{ _id: 'a', status: 'TODO', updatedAt: '2026-01-01T00:00:00Z' }];
    expect(pickNewerByTimestamp(prev, fetched)).toEqual(prev);
  });

  it('takes the fetched version when it is newer or equal', () => {
    const prev = [{ _id: 'a', status: 'TODO', updatedAt: '2026-01-01T00:00:00Z' }];
    const fetched = [{ _id: 'a', status: 'DONE', updatedAt: '2026-01-02T00:00:00Z' }];
    expect(pickNewerByTimestamp(prev, fetched)).toEqual(fetched);
  });

  it('trusts fetched when timestamps are missing/unparseable', () => {
    const prev = [{ _id: 'a', status: 'TODO' }];
    const fetched = [{ _id: 'a', status: 'DONE', updatedAt: '2026-01-02T00:00:00Z' }];
    expect(pickNewerByTimestamp(prev, fetched)).toEqual(fetched);
  });

  it('passes through fetched items with no prev counterpart', () => {
    const fetched = [{ _id: 'b', status: 'TODO', updatedAt: '2026-01-01T00:00:00Z' }];
    expect(pickNewerByTimestamp([], fetched)).toEqual(fetched);
  });
});
