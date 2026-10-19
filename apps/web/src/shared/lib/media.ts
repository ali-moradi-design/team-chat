import { useSyncExternalStore } from 'react';

/** Tracks a CSS media query without re-rendering on every resize event. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

/** ≥ 1024px: sidebar, timeline and a side panel fit next to each other. */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
/** ≥ 768px: sidebar is docked (below that it is a drawer). */
export const useIsTablet = () => useMediaQuery('(min-width: 768px)');
