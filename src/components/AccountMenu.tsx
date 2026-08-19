'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useClerk } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { SURFACE, TEXT, MUTED } from '@/lib/theme';
import DeleteAccountDialog from '@/components/DeleteAccountDialog';

const MENU_WIDTH = 190;

/**
 * The nav's account menu: sign out, and the way in to account deletion.
 *
 * Deletion lives behind the menu rather than beside "sign out" on purpose. The
 * two used to sit one next to the other in early drafts, which puts an
 * irreversible action a mis-click away from the one people press every day.
 *
 * The dropdown is PORTALED to document.body and positioned `fixed`, rather than
 * being an absolutely-positioned child of this component. Both dashboard navs
 * put `overflowX: 'auto'` on the flex row this sits in, so their pills can
 * scroll sideways on a phone — and a non-visible overflow-x forces overflow-y to
 * compute to `auto` as well, because CSS cannot scroll one axis while leaving
 * the other visible. The row is 72px tall, so an absolutely-positioned menu
 * hanging below the button rendered correctly and was then clipped away
 * entirely, with `scrollbarWidth: 'none'` hiding even the scrollbar that would
 * have hinted at it. No z-index fixes that: clipping by an ancestor's overflow
 * happens whatever the stacking order. A portal escapes it by construction, and
 * matches what ConfirmDialog and DeleteAccountDialog already do here.
 */
export default function AccountMenu({ label = 'account' }: { label?: string }) {
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  /** Viewport coords for the portaled menu, measured off the button on open. */
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    // Measured in the click handler rather than an effect: an effect that reads
    // layout and then setStates is the cascading-render pattern the lint rule
    // here rejects, and this is a one-shot read at a known moment anyway.
    setPos({
      top: r.bottom + 8,
      // Anchored to the button's right edge, clamped so a narrow viewport cannot
      // push the menu off-screen.
      right: Math.min(Math.max(window.innerWidth - r.right, 8), Math.max(window.innerWidth - MENU_WIDTH - 8, 8)),
    });
    setOpen(true);
  }

  // Dismissal. Not while the confirm dialog is up — it owns its own, and
  // unmounting this wrapper would take it away mid-request.
  useEffect(() => {
    if (!open || confirming) return;

    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      // The menu is portaled, so it is NOT inside the button's subtree. Both
      // have to be checked or a mousedown on "sign out" would close the menu
      // before the click that follows could ever land on the item.
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); }
    }
    // A fixed-position menu does not follow its button, so anything that moves
    // the button closes it. Captured, to catch scrolling inside the nav row and
    // any other scroll container rather than only the window.
    function onReflow() { setOpen(false); }

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [open, confirming]);

  const item: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left', background: 'none',
    border: 'none', padding: '10px 14px', fontSize: 13, cursor: 'pointer',
    fontFamily: 'inherit', borderRadius: 8,
  };

  const menu = (
    <AnimatePresence>
      {open && pos && (
        <motion.div
          ref={menuRef}
          role="menu"
          aria-label="Account"
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.14 }}
          style={{
            position: 'fixed', top: pos.top, right: pos.right,
            // Above the nav (100) and the page, below the delete dialog (10000)
            // — though opening that closes this anyway.
            zIndex: 9000,
            background: SURFACE, border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: 6, width: MENU_WIDTH,
            boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
          }}
        >
          <button role="menuitem" onClick={() => signOut({ redirectUrl: '/' })} style={{ ...item, color: TEXT }}>
            sign out
          </button>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '5px 8px' }} />
          <button
            role="menuitem"
            onClick={() => { setConfirming(true); setOpen(false); }}
            style={{ ...item, color: '#F87171' }}
          >
            delete account
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div style={{ flexShrink: 0 }}>
      <motion.button
        ref={btnRef}
        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ background: 'transparent', color: MUTED, border: '1px solid rgba(255,255,255,0.1)', padding: '7px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
      >
        {label}
      </motion.button>

      {typeof document !== 'undefined' && createPortal(menu, document.body)}

      <DeleteAccountDialog open={confirming} onCancel={() => setConfirming(false)} />
    </div>
  );
}
