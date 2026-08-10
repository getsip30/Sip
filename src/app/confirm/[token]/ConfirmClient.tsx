'use client';
import { useState } from 'react';
import Link from 'next/link';
import { SURFACE, BORDER, TEXT, MUTED, ACCENT, SUCCESS2, DANGER } from '@/lib/theme';

/**
 * The button behind the confirm link. It POSTs, so that a mail scanner
 * following the emailed URL lands on this page without confirming anything —
 * see the note on POST /api/confirm/[token].
 */
export default function ConfirmClient({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  async function confirm() {
    setState('saving');
    const res = await fetch(`/api/confirm/${token}`, { method: 'POST' });
    if (res.ok) {
      setState('done');
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data?.error || 'Something went wrong. Please try again.');
    setState('error');
  }

  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 32, maxWidth: 420, width: '100%', textAlign: 'center' }}>
      {state === 'done' ? (
        <>
          <h1 style={{ color: SUCCESS2, fontSize: 22, marginBottom: 12 }}>You&rsquo;re confirmed</h1>
          <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
            Thanks — we&rsquo;ve let your mentor know you&rsquo;re still coming. See you at your sip.
          </p>
          <Link href="/seekers" style={{ color: ACCENT, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            Back to your sips →
          </Link>
        </>
      ) : (
        <>
          <h1 style={{ color: TEXT, fontSize: 22, marginBottom: 12 }}>Still coming?</h1>
          <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
            Confirm you&rsquo;ll be at your sip so your mentor knows to expect you.
          </p>
          <button
            onClick={confirm}
            disabled={state === 'saving'}
            style={{ background: ACCENT, color: 'white', border: 'none', padding: '14px 28px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: state === 'saving' ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
          >
            {state === 'saving' ? 'confirming...' : "Yes, I'll be there"}
          </button>
          {state === 'error' && (
            <p style={{ color: DANGER, fontSize: 13, marginTop: 16, marginBottom: 0 }}>{error}</p>
          )}
        </>
      )}
    </div>
  );
}
