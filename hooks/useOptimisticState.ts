// hooks/useOptimisticState.ts
import { useState, useCallback } from 'react';

interface OptimisticStateOptions<T> {
  onCommit: (value: T) => Promise<void>;
  onRollback?: (error: Error) => void;
  onError?: (error: Error) => void;
}

export function useOptimisticState<T>(
  initialValue: T,
  options: OptimisticStateOptions<T>
) {
  const [state, setState] = useState<T>(initialValue);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateState = useCallback(async (newValue: T) => {
    const previousValue = state;
    
    // Optimistic update
    setState(newValue);
    setIsPending(true);
    setError(null);

    try {
      await options.onCommit(newValue);
    } catch (err) {
      const error = err as Error;
      
      // Rollback on error
      setState(previousValue);
      setError(error);
      
      if (options.onRollback) {
        options.onRollback(error);
      }
      
      if (options.onError) {
        options.onError(error);
      }
    } finally {
      setIsPending(false);
    }
  }, [state, options]);

  const reset = useCallback(() => {
    setState(initialValue);
    setError(null);
  }, [initialValue]);

  return {
    state,
    updateState,
    isPending,
    error,
    reset,
  };
}

// Hook for toggling boolean states with optimistic updates
export function useOptimisticToggle(
  initialValue: boolean,
  onToggle: (value: boolean) => Promise<void>
) {
  const { state, updateState, isPending, error } = useOptimisticState(initialValue, {
    onCommit: onToggle,
  });

  const toggle = useCallback(() => {
    updateState(!state);
  }, [state, updateState]);

  return {
    value: state,
    toggle,
    isPending,
    error,
  };
}
