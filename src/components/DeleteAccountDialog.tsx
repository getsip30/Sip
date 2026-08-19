'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useClerk } from '@clerk/nextjs';
import { SURFACE, TEXT, MUTED, DANGER } from '@/lib/theme';

/**
 * The exact string the person has to type. Sent to the server too, which checks
 * it independently — the typing is a speed bump for the human, not the guard.
 */
const CONFIRM_PHRASE = 'DELETE';

/**
 * Second-stage confirmation for account deletion.
 *
 * Deliberately not ConfirmDialog: that component is one click away from
 * confirming, which is right for removing a note and wrong for this. Here the
 * button stays disabled until the phrase is typed exactly, the backdrop does not
 * dismiss while the request is in flight, and what will actually happen is
 * spelled out rather than summarised as "this cannot be undone".
 */
export default function DeleteAccountDialog({ open, onCancel }: { open: boolean; onCancel: () => void }) {
  const { signOut } = useClerk();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every dismissal goes through here so reopening can never show a half-typed
  // phrase or a stale error. Done on the way out rather than in an effect
  // watching `open`, which would be a setState cascade on every close.
  function dismiss() {
    if (busy) return;
    setTyped('');
    setError(null);
    onCancel();
  }

  const armed = typed.trim() === CONFIRM_PHRASE && !busy;

  async function handleDelete() {
    if (!armed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: CONFIRM_PHRASE }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? 'Something went wrong. Please try again.');
        setBusy(false);
        return;
      }
      // The Clerk user is already gone server-side; this clears the local
      // session and sends them to the landing page.
      await signOut({ redirectUrl: '/' });
    } catch {
      setError('Could not reach the server. Please try again.');
      setBusy(false);
    }
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(13,17,23,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={dismiss}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            onClick={e => e.stopPropagation()}
            role="dialog" aria-modal="true" aria-labelledby="delete-account-title"
            style={{ background: SURFACE, border: '1px solid rgba(220,38,38,0.3)', borderRadius: 16, padding: '28px 28px 24px', width: 420, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.55)' }}
          >
            <div id="delete-account-title" style={{ fontSize: 18, fontWeight: 700, color: TEXT, marginBottom: 10, fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>
              delete your account
            </div>

            <p style={{ color: MUTED, fontSize: 13.5, lineHeight: 1.65, marginBottom: 12 }}>
              This removes your profile, your name and your email from Sip, and signs you out. It cannot be undone.
            </p>
            <p style={{ color: MUTED, fontSize: 13.5, lineHeight: 1.65, marginBottom: 12 }}>
              Sessions you took part in stay in the other person&apos;s history, with your name removed — their own private
              notes are theirs to keep. Anything you wrote just for yourself goes with your account.
            </p>

            <label htmlFor="delete-confirm" style={{ display: 'block', color: MUTED, fontSize: 12.5, marginBottom: 8 }}>
              Type <strong style={{ color: TEXT, fontFamily: "var(--font-space-mono), 'Space Mono', monospace" }}>{CONFIRM_PHRASE}</strong> to confirm.
            </label>
            <input
              id="delete-confirm"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              disabled={busy}
              autoComplete="off"
              aria-describedby={error ? 'delete-account-error' : undefined}
              style={{ width: '100%', background: 'rgba(0,0,0,0.25)', border: `1px solid ${armed ? 'rgba(220,38,38,0.5)' : 'rgba(255,255,255,0.12)'}`, borderRadius: 8, padding: '11px 13px', color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: "var(--font-space-mono), 'Space Mono', monospace", marginBottom: error ? 10 : 20 }}
            />

            {error && (
              <div id="delete-account-error" role="alert" style={{ color: DANGER, fontSize: 12.5, lineHeight: 1.5, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={dismiss}
                disabled={busy}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: MUTED, padding: '10px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.5 : 1 }}
              >
                keep my account
              </button>
              <button
                onClick={handleDelete}
                disabled={!armed}
                style={{ background: armed ? 'rgba(220,38,38,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${armed ? 'rgba(220,38,38,0.5)' : 'rgba(255,255,255,0.08)'}`, color: armed ? '#F87171' : MUTED, padding: '10px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: armed ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
              >
                {busy ? 'deleting…' : 'delete account'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
