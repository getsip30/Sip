'use client';
import { useEffect } from 'react';

/**
 * Re-reads server state for views whose data another person can change.
 *
 * A dashboard that loads once shows whatever was true when it mounted. When a
 * mentor cancels a sip, the seeker's open tab keeps the old status forever, and
 * the reverse. Optimistic local updates fix only the tab that made the change.
 *
 * Refetches when the tab regains focus, which is when someone is actually
 * looking, plus a slow interval for a tab left open. Both skip while the
 * document is hidden so a background tab is not polling for nothing.
 */
export function useLiveRefresh(
  refetch: () => void,
  { intervalMs = 60_000, enabled = true }: { intervalMs?: number; enabled?: boolean } = {}
) {
  useEffect(() => {
    if (!enabled) return;

    const refetchIfVisible = () => {
      if (document.visibilityState === 'visible') refetch();
    };

    window.addEventListener('focus', refetchIfVisible);
    document.addEventListener('visibilitychange', refetchIfVisible);
    const timer = setInterval(refetchIfVisible, intervalMs);

    return () => {
      window.removeEventListener('focus', refetchIfVisible);
      document.removeEventListener('visibilitychange', refetchIfVisible);
      clearInterval(timer);
    };
  }, [refetch, intervalMs, enabled]);
}
