'use client';
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BORDER, MUTED, LINK, TEXT } from '@/lib/theme';
import { ease, DUR, badgeVariants, badgeTransition } from '@/lib/motion';

export const REQUEST_FILTERS = ['all', 'pending', 'accepted', 'cancelled'] as const;
export type RequestFilter = typeof REQUEST_FILTERS[number];

/** How many rows are shown before the list has to be asked to grow. */
export const PAGE_SIZE = 5;

type WithStatus = { status: string };

/**
 * Filtering and paging for a request history, shared so the seeker's and the
 * mentor's list behave the same way.
 *
 * Declined requests are deliberately not their own filter; they are reachable
 * under "all". The four here are the states someone actually goes looking for.
 */
export function useRequestList<T extends WithStatus>(items: T[]) {
  const [filter, setFilter] = useState<RequestFilter>('all');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const counts = useMemo(() => {
    const c: Record<RequestFilter, number> = { all: items.length, pending: 0, accepted: 0, cancelled: 0 };
    for (const i of items) {
      if (i.status === 'pending') c.pending++;
      else if (i.status === 'accepted') c.accepted++;
      else if (i.status === 'cancelled') c.cancelled++;
    }
    return c;
  }, [items]);

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter(i => i.status === filter)),
    [items, filter]
  );

  // Collapsing back on a filter change keeps "show more" meaning the same thing
  // in every view, rather than carrying one list's expansion into the next.
  const changeFilter = (next: RequestFilter) => {
    setFilter(next);
    setVisible(PAGE_SIZE);
  };

  return {
    filter,
    setFilter: changeFilter,
    counts,
    filtered,
    shown: filtered.slice(0, visible),
    hiddenCount: Math.max(0, filtered.length - visible),
    expanded: visible > PAGE_SIZE,
    showMore: () => setVisible(v => v + PAGE_SIZE),
    collapse: () => setVisible(PAGE_SIZE),
  };
}

export function RequestFilterBar({
  filter,
  onChange,
  counts,
}: {
  filter: RequestFilter;
  onChange: (f: RequestFilter) => void;
  counts: Record<RequestFilter, number>;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      {REQUEST_FILTERS.map(f => {
        const active = filter === f;
        const count = counts[f];
        return (
          <motion.button
            key={f}
            onClick={() => onChange(f)}
            aria-pressed={active}
            whileTap={{ scale: 0.96 }}
            transition={ease(DUR.fast)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: active ? 'rgba(112,181,249,0.12)' : 'transparent',
              border: `1px solid ${active ? 'rgba(112,181,249,0.4)' : BORDER}`,
              color: active ? LINK : MUTED,
              padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {f}
            <AnimatePresence initial={false}>
              {count > 0 && (
                <motion.span key="c" variants={badgeVariants} initial="hidden" animate="visible" exit="exit" transition={badgeTransition}
                  style={{ fontSize: 11, fontWeight: 700, color: active ? LINK : MUTED, opacity: 0.75, display: 'inline-block' }}>
                  {count}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
}

export function ShowMore({
  hiddenCount,
  expanded,
  onMore,
  onCollapse,
}: {
  hiddenCount: number;
  expanded: boolean;
  onMore: () => void;
  onCollapse: () => void;
}) {
  if (hiddenCount === 0 && !expanded) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16 }}>
      {hiddenCount > 0 && (
        <motion.button onClick={onMore} whileTap={{ scale: 0.97 }} transition={ease(DUR.fast)}
          style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: TEXT, padding: '9px 20px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          show {Math.min(hiddenCount, PAGE_SIZE)} more
          <span style={{ color: MUTED, fontWeight: 400 }}> · {hiddenCount} left</span>
        </motion.button>
      )}
      {expanded && (
        <motion.button onClick={onCollapse} whileTap={{ scale: 0.97 }} transition={ease(DUR.fast)}
          style={{ background: 'transparent', border: 'none', color: MUTED, padding: '9px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          collapse
        </motion.button>
      )}
    </div>
  );
}
