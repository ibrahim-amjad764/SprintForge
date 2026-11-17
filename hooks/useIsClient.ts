"use client";

import { useSyncExternalStore } from "react";

/**
 * Returns `false` during SSR and the first client render (hydration),
 * `true` afterwards. Use for portal mounting and hydration-sensitive UI.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}
