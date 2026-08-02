'use client';
import { useState } from 'react';
import { BG, SURFACE, BORDER, TEXT, MUTED, ACCENT, WARNING, SUCCESS2 } from '@/lib/theme';

/**
 * Post-session feedback for a live room, shown to whichever side just finished.
 * The copy states outright that the other person never sees it, because that is
 * the only reason either side would answer the "would you sip again" question
 * honestly.
 */
export default function SessionFeedbackPrompt({
  roomId,
  seekerClerkId,
  personName,
  onDone,
}: {
  roomId: string;
  /** Only sent by the mentor, who is rating a specific seeker. */
  seekerClerkId?: string;
  personName: string;
  onDone?: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [again, setAgain] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!rating) return;
    setSaving(true);
    setError(null);
    const res = await fetch('/api/session-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, seekerClerkId, rating, wouldSipAgain: again, comment: comment.trim() || undefined }),
    });
    if (res.ok) {
      setDone(true);
      onDone?.();
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error || 'Could not send that. Try again.');
    }
    setSaving(false);
  }

  if (done) {
    return (
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 22px', color: SUCCESS2, fontSize: 14, fontWeight: 600 }}>
        Thanks, that&apos;s logged.
      </div>
    );
  }

  const pill = (active: boolean): React.CSSProperties => ({
    background: active ? 'rgba(112,181,249,0.15)' : 'transparent',
    border: `1px solid ${active ? 'rgba(112,181,249,0.4)' : BORDER}`,
    color: active ? ACCENT : MUTED,
    padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  });

  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px 24px' }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>How was your sip with {personName}?</div>
      <div style={{ color: MUTED, fontSize: 12, marginBottom: 16 }}>Only the Sip team sees this. {personName} never does.</div>

      <div role="radiogroup" aria-label="Rating out of 5" style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} out of 5`}
            onClick={() => setRating(n)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 24, lineHeight: 1, color: rating >= n ? WARNING : 'rgba(255,255,255,0.2)' }}>
            ★
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>Would you sip again?</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => setAgain(true)} aria-pressed={again === true} style={pill(again === true)}>yes</button>
          <button type="button" onClick={() => setAgain(false)} aria-pressed={again === false} style={pill(again === false)}>no</button>
        </div>
      </div>

      <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} maxLength={1000}
        placeholder="anything else? (optional)"
        style={{ width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 12px', color: TEXT, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />

      {error && <div role="alert" style={{ color: '#F87171', fontSize: 12, marginTop: 8 }}>{error}</div>}

      <button onClick={submit} disabled={saving || !rating}
        style={{ marginTop: 12, background: ACCENT, border: 'none', color: 'white', padding: '9px 22px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: saving || !rating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving || !rating ? 0.6 : 1 }}>
        {saving ? 'sending...' : 'send feedback'}
      </button>
    </div>
  );
}
