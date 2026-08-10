'use client';
import { useState, useEffect } from 'react';
import { BG, BORDER, TEXT, MUTED } from '@/lib/theme';
import { isWithinNoShowWindow, noShowWindowClosesAt } from '@/lib/no-show';

const DANGER = '#F87171';

/**
 * "Mark no-show", live for the grace period only.
 *
 * The window is time-based, so the component keeps its own clock rather than
 * reading the time once at render — otherwise a dashboard left open since
 * before the session would never show the button, and one left open through the
 * session would never stop showing it. The server re-checks the window anyway;
 * this only decides what is on screen.
 */
export default function NoShowButton({
  requestId,
  scheduledAt,
  sessionStatus,
  reporting,
  onMarked,
}: {
  requestId: string;
  scheduledAt: string | null | undefined;
  sessionStatus: string | null | undefined;
  /** Which side is being reported — determines the wording only; the server derives the real value. */
  reporting: 'mentor' | 'seeker';
  onMarked: (sessionStatus: string) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const closesAt = noShowWindowClosesAt(scheduledAt ?? null);

  useEffect(() => {
    // Nothing to count down to once the window has closed, so the interval is
    // not started at all rather than left ticking on every open dashboard.
    if (!closesAt || Date.now() > closesAt.getTime()) return;
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [closesAt]);

  if (sessionStatus === 'no_show_mentor' || sessionStatus === 'no_show_seeker') {
    return (
      <span style={{ color: DANGER, fontSize: 12, fontWeight: 600 }}>
        marked as no-show
      </span>
    );
  }

  if (!isWithinNoShowWindow(scheduledAt ?? null, now)) return null;

  const minutesLeft = closesAt ? Math.max(0, Math.ceil((closesAt.getTime() - now) / 60000)) : 0;
  const who = reporting === 'mentor' ? 'your mentor' : 'the seeker';

  async function submit() {
    setSaving(true);
    setError('');
    const res = await fetch(`/api/requests/${requestId}/no-show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evidenceUrl: evidenceUrl.trim() || null }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      onMarked(data.sessionStatus);
      setOpen(false);
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data?.error || 'something went wrong, try again');
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', color: DANGER, padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        mark no-show ({minutesLeft}m left)
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      <span style={{ color: MUTED, fontSize: 12 }}>
        Confirm {who} did not turn up. This is recorded for review — it does not cancel anything.
      </span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="url"
          value={evidenceUrl}
          onChange={e => setEvidenceUrl(e.target.value)}
          placeholder="optional screenshot link"
          aria-label="Optional evidence link"
          maxLength={500}
          style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', color: TEXT, fontSize: 12, fontFamily: 'inherit', flex: '1 1 200px', minWidth: 0 }}
        />
        <button
          onClick={submit}
          disabled={saving}
          style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', color: DANGER, padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
        >
          {saving ? 'saving...' : 'confirm no-show'}
        </button>
        <button
          onClick={() => { setOpen(false); setError(''); }}
          style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED, padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          never mind
        </button>
      </div>
      {error && <span style={{ color: DANGER, fontSize: 11 }}>{error}</span>}
    </div>
  );
}
