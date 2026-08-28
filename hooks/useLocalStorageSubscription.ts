import { useEffect, useState, useCallback } from 'react';

interface LocalStorageSubscriptionOptions {
  key: string;
  callback?: (newValue: any) => void;
}

/**
 * Hook for subscribing to LocalStorage changes
 * Supports both cross-tab sync (via storage event) and same-tab sync (via custom event)
 */
export function useLocalStorageSubscription(options: LocalStorageSubscriptionOptions) {
  const { key, callback } = options;
  const [value, setValue] = useState<any>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error(`Error parsing LocalStorage key "${key}":`, error);
      return null;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Handle cross-tab storage events
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key) {
        try {
          const newValue = event.newValue ? JSON.parse(event.newValue) : null;
          setValue(newValue);
          callback?.(newValue);
        } catch (error) {
          console.error(`Error parsing LocalStorage key "${key}":`, error);
        }
      }
    };

    // Handle same-tab custom events
    const handleCustomEvent = (event: CustomEvent) => {
      if (event.detail?.key === key) {
        try {
          const item = localStorage.getItem(key);
          const newValue = item ? JSON.parse(item) : null;
          setValue(newValue);
          callback?.(newValue);
        } catch (error) {
          console.error(`Error parsing LocalStorage key "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localStorageChange', handleCustomEvent as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageChange', handleCustomEvent as EventListener);
    };
  }, [key, callback]);

  return value;
}

/**
 * Helper function to dispatch custom event after LocalStorage update
 * Call this after localStorage.setItem to trigger subscriptions in the same tab
 */
export function dispatchLocalStorageChange(key: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('localStorageChange', { 
      detail: { key } 
    }));
  }
}
