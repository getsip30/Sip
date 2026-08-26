'use client';
import { useState } from 'react';
import { SURFACE, BG, BORDER, TEXT, MUTED, LINK, SUCCESS2, DANGER } from '@/lib/theme';
import { MAX_ANSWER_LENGTH } from '@/lib/reflections';

export type Reflection = {
  didDifferently: string | null;
  counterfactual: string | null;
  shareable: boolean;
};

/**
 * The two reflection questions and the sharing opt-in, shown on a request card
 * once the call is an hour behind.
 *
 * Deliberately not a "did you like it?" form — @/components/SessionFeedbackPrompt
 * and the star rating above this already ask that. These two questions are about
 * what actually changed, which is the thing a rating cannot tell us.
 *
 * An already-saved reflection comes back as the starting value rather than
 * locking the form, because the honest answer to "what are you doing
 * differently?" often arrives a day late. Re-submitting edits the same row.
 */
export default function ReflectionForm({
  requestId,
  existing,
  onSaved,
}: {
  requestId: string;
  existing: Reflection | null;
  onSaved: (saved: Reflection) => void;
}) {
  const [didDifferently, setDidDifferently] = useState(existing?.didDifferently ?? '');
  const [counterfactual, setCounterfactual] = useState(existing?.counterfactual ?? '');
  const [shareable, setShareable] = useState(existing?.shareable ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  const empty = !didDifferently.trim() && !counterfactual.trim();

  async function submit() {
    if (empty || saving) return;
    setSaving(true);
    setError('');
    setJustSaved(false);
    try {
      // Fire-and-forget from the seeker's point of view: the card does not block
      // on it, and a failure says so rather than silently discarding what they
      // typed, which is still sitting in the boxes to retry.
      const res = await fetch('/api/reflections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          didDifferently: didDifferently.trim() || null,
          counterfactual: counterfactual.trim() || null,
          shareable,
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        setJustSaved(true);
        onSaved({
          didDifferently: saved.didDifferently ?? null,
          counterfactual: saved.counterfactual ?? null,
          shareable: !!saved.shareable,
        });
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Something went wrong. Try again.');
      }
    } catch {
      setError('Something went wrong. Try again.');
    }
    setSaving(false);
  }

  const boxStyle = {
    width: '100%', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8,
    padding: '8px 10px', color: TEXT, fontSize: 13, outline: 'none', resize: 'none' as const,
    boxSizing: 'border-box' as const, fontFamily: 'inherit', lineHeight: 1.6,
  };

  return (
    <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={`did-${requestId}`} style={{ color: TEXT, fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
          What&rsquo;s one thing you&rsquo;re doing differently because of this call?
        </label>
        <textarea
          id={`did-${requestId}`} value={didDifferently} rows={2} maxLength={MAX_ANSWER_LENGTH}
          onChange={e => setDidDifferently(e.target.value)}
          placeholder="one concrete thing..." style={boxStyle}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={`counter-${requestId}`} style={{ color: TEXT, fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
          What would this week have looked like if you&rsquo;d skipped this call?
        </label>
        <textarea
          id={`counter-${requestId}`} value={counterfactual} rows={2} maxLength={MAX_ANSWER_LENGTH}
          onChange={e => setCounterfactual(e.target.value)}
          placeholder="be honest — 'about the same' is a real answer" style={boxStyle}
        />
      </div>

      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer', color: MUTED, fontSize: 12, lineHeight: 1.5 }}>
        <input
          type="checkbox" checked={shareable} onChange={e => setShareable(e.target.checked)}
          style={{ marginTop: 2, accentColor: 'var(--accent)', cursor: 'pointer' }}
        />
        <span>Okay if we share your answer publicly?</span>
      </label>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {justSaved && <span style={{ color: SUCCESS2, fontSize: 12 }}>saved</span>}
        {error && <span style={{ color: DANGER, fontSize: 12 }}>{error}</span>}
        <button
          onClick={submit} disabled={saving || empty}
          style={{
            background: 'rgba(112,181,249,0.12)', border: '1px solid rgba(112,181,249,0.3)', color: LINK,
            padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            cursor: saving || empty ? 'not-allowed' : 'pointer', opacity: empty ? 0.5 : 1,
          }}
        >
          {saving ? 'saving...' : existing ? 'update answers' : 'send answers'}
        </button>
      </div>
    </div>
  );
}
