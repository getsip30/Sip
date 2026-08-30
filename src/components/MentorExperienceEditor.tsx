'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { BG, BORDER, TEXT, MUTED, ACCENT, DANGER } from '@/lib/theme';
import { MAX_EXPERIENCES, MAX_COMPANY_LENGTH, MAX_TITLE_LENGTH } from '@/lib/mentor-experience';

export type ExperienceRow = { company: string; title: string; isCurrent: boolean };

/**
 * The work-experience section: a current role, and a "+" for the ones before it.
 *
 * Two short inputs per entry and nothing else. There is no description field
 * here and there should never be one — the section exists so a seeker can spot
 * "founded it, sold it" in two seconds rather than opening LinkedIn to find
 * out who they are talking to, and a paragraph box turns it back into the thing
 * it is meant to replace. The title placeholder is doing real work: it shows a
 * one-liner, so that is what people write.
 */
export default function MentorExperienceEditor({
  value,
  onChange,
}: {
  value: ExperienceRow[];
  onChange: (rows: ExperienceRow[]) => void;
}) {
  const set = (i: number, patch: Partial<ExperienceRow>) =>
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const add = () => {
    if (value.length >= MAX_EXPERIENCES) return;
    onChange([...value, { company: '', title: '', isCurrent: false }]);
  };

  const input: React.CSSProperties = {
    width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 10,
    padding: '10px 14px', color: TEXT, fontSize: 14, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <AnimatePresence initial={false}>
          {value.map((row, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, flex: 1 }}>
                  <input
                    value={row.company}
                    maxLength={MAX_COMPANY_LENGTH}
                    onChange={e => set(i, { company: e.target.value })}
                    placeholder="company"
                    aria-label={`Company for role ${i + 1}`}
                    style={input}
                  />
                  <input
                    value={row.title}
                    maxLength={MAX_TITLE_LENGTH}
                    onChange={e => set(i, { title: e.target.value })}
                    placeholder={i === 0 ? 'what you do there' : 'e.g. founded it, sold it in 2019'}
                    aria-label={`Title for role ${i + 1}`}
                    style={input}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove role ${i + 1}`}
                  style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 10, width: 40, height: 40, flexShrink: 0, color: MUTED, fontSize: 18, lineHeight: 1, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ×
                </button>
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, color: MUTED, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={row.isCurrent}
                  onChange={e => set(i, { isCurrent: e.target.checked })}
                  style={{ width: 14, height: 14, accentColor: ACCENT, cursor: 'pointer' }}
                />
                I still do this
              </label>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {value.length >= MAX_EXPERIENCES ? (
        <div style={{ color: MUTED, fontSize: 12, marginTop: 12 }}>
          {MAX_EXPERIENCES} roles is the limit — pick the ones worth bragging about.
        </div>
      ) : (
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={add}
          style={{ marginTop: 12, background: 'transparent', border: `1px dashed ${BORDER}`, borderRadius: 10, padding: '10px 16px', color: MUTED, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          + {value.length === 0 ? 'add a role' : 'add a past role'}
        </motion.button>
      )}

      {value.some(r => r.title.length >= MAX_TITLE_LENGTH) && (
        <div style={{ color: DANGER, fontSize: 12, marginTop: 8 }}>
          That&apos;s the {MAX_TITLE_LENGTH}-character limit. It&apos;s a one-liner, not a job description — say the impressive part and stop.
        </div>
      )}
    </div>
  );
}
