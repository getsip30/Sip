'use client';
import { useCallback, useMemo, useState } from 'react';
import type { Takeaway, Participant } from '@/components/SessionTakeaways';

export type TakeawaySession = {
  kind: 'request' | 'room' | 'archived';
  sessionId: string;
  sessionDate: string;
  sessionLabel: string;
  role: 'mentor' | 'seeker';
  /** False once the session is closed to new notes; existing ones still show. */
  writable: boolean;
  participants?: Participant[];
  takeaways: Takeaway[];
};

/**
 * The caller's own takeaways, and the sessions they may write more against.
 *
 * One fetch serves both jobs a dashboard has here: the grouped Takeaways section
 * and the inline composer on a session card. GET /api/takeaways already returns
 * every eligible session with the caller's own notes attached, so indexing it by
 * id locally is cheaper than asking per card, and there is nothing to join into
 * the existing endpoints — a takeaway is never shown to the other side, so no
 * other view needs to know it exists.
 *
 * `role` filters to the side the calling dashboard represents, because a user
 * can be a mentor and a seeker at once and each dashboard shows only its own.
 */
export function useTakeaways(role: 'mentor' | 'seeker') {
  const [sessions, setSessions] = useState<TakeawaySession[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/takeaways');
      if (res.ok) setSessions(await res.json());
    } catch {
      // A failed refresh leaves the last good list on screen. Takeaways are a
      // side panel, not the reason someone opened the dashboard.
    } finally {
      setLoaded(true);
    }
  }, []);

  const mine = useMemo(() => sessions.filter(s => s.role === role), [sessions, role]);

  /** Index by session id, for the inline composer on a request or room card. */
  const bySession = useMemo(() => {
    const map = new Map<string, TakeawaySession>();
    for (const s of mine) map.set(s.sessionId, s);
    return map;
  }, [mine]);

  /**
   * Fold a save back in. The server upserts, so a re-save of an existing note
   * comes back with the same id and replaces it rather than stacking.
   */
  const applySaved = useCallback((sessionId: string, saved: Takeaway) => {
    setSessions(prev => prev.map(s => {
      if (s.sessionId !== sessionId) return s;
      const existing = s.takeaways.some(t => t.id === saved.id);
      return {
        ...s,
        takeaways: existing
          ? s.takeaways.map(t => (t.id === saved.id ? saved : t))
          : [...s.takeaways, saved],
      };
    }));
  }, []);

  const applyDeleted = useCallback((sessionId: string, id: string) => {
    setSessions(prev => prev.map(s => (
      s.sessionId === sessionId ? { ...s, takeaways: s.takeaways.filter(t => t.id !== id) } : s
    )));
  }, []);

  /** Sessions worth listing in the grouped section: ones already written on. */
  const written = useMemo(() => mine.filter(s => s.takeaways.length > 0), [mine]);

  const total = useMemo(
    () => mine.reduce((sum, s) => sum + s.takeaways.length, 0),
    [mine]
  );

  return { sessions: mine, bySession, written, total, loaded, refresh, applySaved, applyDeleted };
}
