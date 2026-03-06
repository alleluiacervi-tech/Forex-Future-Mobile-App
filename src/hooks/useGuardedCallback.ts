// ADDED: double-tap prevention hook (CHECK 7)
import { useRef, useCallback } from 'react';

/**
 * Wraps an async callback so that rapid successive calls are ignored
 * while the first invocation is still in flight.
 */
export function useGuardedCallback<T extends (...args: any[]) => Promise<any>>(
  callback: T,
  deps: React.DependencyList,
): T {
  const busyRef = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const guarded = useCallback(
    (async (...args: any[]) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        return await callback(...args);
      } finally {
        busyRef.current = false;
      }
    }) as unknown as T,
    deps,
  );

  return guarded;
}
