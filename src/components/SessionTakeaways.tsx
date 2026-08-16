'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BG, SURFACE, BORDER, TEXT, MUTED, LINK, DANGER } from '@/lib/theme';
import { ease, DUR } from '@/lib/motion';
import { MAX_BULLETS, MAX_BULLET_LEN } from '@/lib/takeaways';

export type Takeaway = {
  id: string;
  subjectSeekerClerkId: string | null;
  subjectName: string | null;
  bullets: string[];
  updatedAt: string;
};

export type Participant = { clerkId: string; name: string };

/** Which note within a session is being written: the group one, or one person's. */
type Slot = { subject: string | null };

const GROUP_LABEL = 'Group Takeaway';

/**
 * The Takeaways composer for one session, used on both dashboards and in a live
 * room.
 *
 * Takeaways are private to whoever wrote them — a mentor's and a seeker's never
 * meet — so the privacy line is not decoration. Both sides write theirs from
 * screens that look alike, and the only thing telling someone their note is not
 * being read by the other person is that sentence.
 *
 * `participants` is passed for a live room's host only. Given it, the composer
 * offers one note for the whole session plus one per person who was in the room;
 * without it there is a single note, which is every other case. Nothing is
 * forced: a mentor can write the group note, some of the per-person ones, all of
 * them, or none.
 */
export default function SessionTakeaways({
  target,
  takeaways,
  participants,
  onSaved,
  onDeleted,
  compact = false,
  readOnly = false,
}: {
  target: { kind: 'request' | 'room'; sessionId: string };
  takeaways: Takeaway[];
  participants?: Participant[];
  onSaved: (saved: Takeaway) => void;
  onDeleted: (id: string) => void;
  /** Denser presentation for inline use on a request card. */
  compact?: boolean;
  /**
   * The session no longer accepts writes — it was cancelled, or its parent is
   * gone. Existing notes stay readable and deletable; only adding and editing
   * go away, because the API would refuse those and an editor that cannot save
   * is worse than no editor.
   */
  readOnly?: boolean;
}) {
  const [openSlot, setOpenSlot] = useState<Slot | null>(null);
  const [draft, setDraft] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const perPerson = participants ?? [];
  const written = new Set(takeaways.map(t => t.subjectSeekerClerkId ?? '__group__'));

  function keyFor(subject: string | null) {
    return subject ?? '__group__';
  }

  function labelFor(subject: string | null) {
    if (!subject) return perPerson.length > 0 ? GROUP_LABEL : 'Your takeaways';
    return `${perPerson.find(p => p.clerkId === subject)?.name ?? 'Seeker'} Takeaway`;
  }

  function open(subject: string | null) {
    const existing = takeaways.find(t => (t.subjectSeekerClerkId ?? null) === subject);
    setDraft(existing ? [...existing.bullets] : ['']);
    setOpenSlot({ subject });
    setError('');
  }

  function close() {
    setOpenSlot(null);
    setDraft(['']);
    setError('');
  }

  async function save() {
    if (!openSlot) return;
    const bullets = draft.map(b => b.trim()).filter(Boolean);
    if (bullets.length === 0) {
      setError('Write at least one bullet.');
      return;
    }
    setSaving(true);
    setError('');
    const res = await fetch('/api/takeaways', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        [target.kind === 'room' ? 'roomId' : 'requestId']: target.sessionId,
        subjectSeekerClerkId: openSlot.subject,
        bullets,
      }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved(await res.json());
      close();
      return;
    }
    const body = await res.json().catch(() => null);
    setError(body?.error || 'Could not save that. Try again.');
  }

  async function remove(id: string) {
    setDeleting(id);
    const res = await fetch(`/api/takeaways/${id}`, { method: 'DELETE' });
    setDeleting(null);
    if (res.ok) {
      onDeleted(id);
      return;
    }
    const body = await res.json().catch(() => null);
    setError(body?.error || 'Could not delete that. Try again.');
  }

  // Slots with nothing written yet, which is what the "add" row offers. A slot
  // that already has a note is reached through its own edit button instead, so
  // the two can never both be on screen for the same note.
  const emptySlots: (string | null)[] = [
    ...(written.has('__group__') ? [] : [null]),
    ...perPerson.filter(p => !written.has(p.clerkId)).map(p => p.clerkId),
  ];

  const editing = openSlot !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Takeaways</span>
          <span style={{ color: MUTED, fontSize: 11 }}>only you can see these</span>
        </div>
      )}

      {takeaways.map(t => (
        <div key={t.id} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
            <span style={{ color: LINK, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t.subjectSeekerClerkId ? `${t.subjectName ?? 'Seeker'} Takeaway` : (perPerson.length > 0 ? GROUP_LABEL : 'Your takeaways')}
            </span>
            <span style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {!readOnly && (
                <button onClick={() => open(t.subjectSeekerClerkId)}
                  style={{ background: 'none', border: 'none', color: MUTED, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                  edit
                </button>
              )}
              <button onClick={() => remove(t.id)} disabled={deleting === t.id}
                style={{ background: 'none', border: 'none', color: DANGER, fontSize: 11, fontWeight: 600, cursor: deleting === t.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', padding: 0 }}>
                {deleting === t.id ? 'deleting...' : 'delete'}
              </button>
            </span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: TEXT, fontSize: 13, lineHeight: 1.6 }}>
            {t.bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      ))}

      <AnimatePresence initial={false}>
        {editing && (
          <motion.div key="editor" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={ease(DUR.fast)}
            style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ color: MUTED, fontSize: 11, fontWeight: 600 }}>
              {labelFor(openSlot.subject)} · up to {MAX_BULLETS} bullets, only you can see these
            </span>
            {draft.map((line, i) => (
              <input key={i} value={line} maxLength={MAX_BULLET_LEN}
                aria-label={`Bullet ${i + 1}`}
                placeholder={i === 0 ? 'e.g. Rewrite the CV summary around outcomes' : 'another takeaway...'}
                onChange={e => setDraft(d => d.map((v, j) => j === i ? e.target.value : v))}
                style={{ width: '100%', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', color: TEXT, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            ))}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {draft.length < MAX_BULLETS && (
                <button onClick={() => setDraft(d => [...d, ''])}
                  style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED, padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  + bullet
                </button>
              )}
              <button onClick={save} disabled={saving}
                style={{ background: 'rgba(112,181,249,0.12)', border: '1px solid rgba(112,181,249,0.3)', color: LINK, padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'saving...' : 'save'}
              </button>
              <button onClick={close}
                style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED, padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {readOnly && takeaways.length > 0 && (
        <span style={{ color: MUTED, fontSize: 11 }}>
          This session is closed, so these can&apos;t be changed. They stay here for you until you delete them.
        </span>
      )}

      {!readOnly && !editing && emptySlots.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {emptySlots.map(subject => (
            <button key={keyFor(subject)} onClick={() => open(subject)}
              style={{ background: 'transparent', border: `1px dashed ${BORDER}`, color: MUTED, padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              + {subject === null && perPerson.length === 0 ? 'add takeaways' : labelFor(subject)}
            </button>
          ))}
          {compact && <span style={{ color: MUTED, fontSize: 11 }}>only you can see these</span>}
        </div>
      )}

      {error && <span style={{ color: DANGER, fontSize: 11 }}>{error}</span>}
    </div>
  );
}
