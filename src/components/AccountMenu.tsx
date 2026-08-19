'use client';
import { useEffect, useRef, useState } from 'react';
import { useClerk } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { SURFACE, TEXT, MUTED } from '@/lib/theme';
import DeleteAccountDialog from '@/components/DeleteAccountDialog';

/**
 * The nav's account menu: sign out, and the way in to account deletion.
 *
 * Deletion lives behind the menu rather than beside "sign out" on purpose. The
 * two used to sit one next to the other in early drafts, which puts an
 * irreversible action a mis-click away from the one people press every day.
 */
export default function AccountMenu({ label = 'account' }: { label?: string }) {
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape. Not while the confirm dialog is up —
  // it owns its own dismissal, and unmounting this wrapper would take it away
  // mid-request.
  useEffect(() => {
    if (!open || confirming) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, confirming]);

  const item: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left', background: 'none',
    border: 'none', padding: '10px 14px', fontSize: 13, cursor: 'pointer',
    fontFamily: 'inherit', borderRadius: 8,
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
      <motion.button
        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ background: 'transparent', color: MUTED, border: '1px solid rgba(255,255,255,0.1)', padding: '7px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
      >
        {label}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 200, background: SURFACE, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 6, width: 190, boxShadow: '0 12px 32px rgba(0,0,0,0.45)' }}
          >
            <button
              role="menuitem"
              onClick={() => signOut({ redirectUrl: '/' })}
              style={{ ...item, color: TEXT }}
            >
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

      <DeleteAccountDialog open={confirming} onCancel={() => setConfirming(false)} />
    </div>
  );
}
