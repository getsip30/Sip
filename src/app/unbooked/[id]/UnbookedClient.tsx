'use client';
import { useState } from 'react';
import Link from 'next/link';
import { SURFACE, BORDER, TEXT, MUTED, ACCENT, SUCCESS2, DANGER } from '@/lib/theme';

type Done = 'nudged' | 'reported';

/**
 * The two actions behind the mentor's no-time-set email.
 *
 * Both POST, so a mail scanner following either emailed URL lands here without
 * nudging anyone or filing anything — see the note on POST /api/confirm/[token].
 *
 * Reporting asks for a confirmation press first. Nudging is a friendly email
 * that costs nothing if it was a misclick; reporting puts a person's name in a
 * review queue, and those two should not be one keystroke apart.
 */
export default function UnbookedClient({
  requestId,
  startOnReport,
}: {
  requestId: string;
  startOnReport: boolean;
}) {
  const [busy, setBusy] = useState<'nudge' | 'report' | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState('');
  const [confirmingReport, setConfirmingReport] = useState(startOnReport);

  async function run(action: 'nudge' | 'report') {
    setBusy(action);
    setError('');
    const path = action === 'nudge' ? 'nudge-seeker' : 'report-unbooked';
    try {
      const res = await fetch(`/api/requests/${requestId}/${path}`, { method: 'POST' });
      if (res.ok) {
        setDone(action === 'nudge' ? 'nudged' : 'reported');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setBusy(null);
  }

  const card = {
    background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16,
    padding: 32, maxWidth: 440, width: '100%', textAlign: 'center' as const,
  };
  const primary = {
    background: ACCENT, color: 'white', border: 'none', padding: '14px 28px',
    borderRadius: 12, fontSize: 15, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  };
  const quiet = {
    background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`,
    padding: '12px 22px', borderRadius: 12, fontSize: 14, fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer',
  };

  if (done) {
    return (
      <div style={card}>
        <h1 style={{ color: SUCCESS2, fontSize: 22, marginBottom: 12 }}>
          {done === 'nudged' ? 'Nudge sent' : 'Thanks — we’ll take a look'}
        </h1>
        <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
          {done === 'nudged'
            ? 'We’ve asked them to pick a time. You’ll see it on your dashboard as soon as they do.'
            : 'It’s in the review queue. Nothing happens to their account automatically — someone will read it.'}
        </p>
        <Link href="/dashboard" style={{ color: ACCENT, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
          Back to your dashboard →
        </Link>
      </div>
    );
  }

  return (
    <div style={card}>
      <h1 style={{ color: TEXT, fontSize: 22, marginBottom: 12 }}>No time set yet</h1>
      <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
        You accepted this sip two days ago and there&rsquo;s still nothing on the calendar.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <button onClick={() => run('nudge')} disabled={busy !== null} style={primary}>
          {busy === 'nudge' ? 'sending...' : 'Nudge them'}
        </button>

        {confirmingReport ? (
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16, width: '100%' }}>
            <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
              This flags the sip for a human to review. Nothing happens to their account on its own.
            </p>
            <button onClick={() => run('report')} disabled={busy !== null} style={quiet}>
              {busy === 'report' ? 'reporting...' : 'Yes, report as no-show'}
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmingReport(true)} disabled={busy !== null}
            style={{ ...quiet, border: 'none', padding: 0, fontSize: 13, fontWeight: 400 }}>
            or report as no-show
          </button>
        )}
      </div>

      {error && <p style={{ color: DANGER, fontSize: 13, marginTop: 16, marginBottom: 0 }}>{error}</p>}
    </div>
  );
}
