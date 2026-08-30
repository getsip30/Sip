'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { BG, BORDER, TEXT, MUTED, ACCENT, LINK } from '@/lib/theme';
import { TAG_GROUPS, MAX_TAGS, MAX_TAG_LENGTH, normalizeTag } from '@/lib/mentor-tags';

/**
 * The tag picker for mentor onboarding.
 *
 * Suggestions first, free text second, and both always visible. A picker that
 * hides the custom box behind an "other" button gets a page of profiles that
 * all say the same six things; a picker that offers only an empty box gets a
 * page of blank ones. The suggestions are there to show the KIND of thing that
 * belongs here — "dropped out", "cat person" — more than to be chosen.
 */
export default function MentorTagPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [custom, setCustom] = useState('');
  const atLimit = value.length >= MAX_TAGS;

  const toggle = (tag: string) => {
    const t = normalizeTag(tag);
    if (!t) return;
    if (value.includes(t)) return onChange(value.filter(x => x !== t));
    if (atLimit) return;
    onChange([...value, t]);
  };

  const addCustom = () => {
    const t = normalizeTag(custom);
    setCustom('');
    if (!t || value.includes(t) || atLimit) return;
    onChange([...value, t]);
  };

  const pill = (selected: boolean): React.CSSProperties => ({
    padding: '7px 14px',
    borderRadius: 20,
    border: '1px solid',
    borderColor: selected ? ACCENT : BORDER,
    background: selected ? 'rgba(10,102,194,0.2)' : 'transparent',
    color: selected ? LINK : MUTED,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  });

  return (
    <div>
      {/* What they have picked so far, including anything they typed. Shown
          above the suggestions so the profile they are building stays in view. */}
      {value.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {value.map(t => (
            <motion.button
              key={t}
              type="button"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onChange(value.filter(x => x !== t))}
              aria-label={`Remove tag ${t}`}
              style={{ ...pill(true), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {t}
              <span aria-hidden style={{ opacity: 0.6, fontSize: 15, lineHeight: 1 }}>×</span>
            </motion.button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          value={custom}
          maxLength={MAX_TAG_LENGTH}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); addCustom(); }
          }}
          disabled={atLimit}
          placeholder={atLimit ? `that's ${MAX_TAGS} — plenty` : 'or type your own, whatever it is'}
          aria-label="Add your own tag"
          style={{ flex: 1, background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 14px', color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', opacity: atLimit ? 0.5 : 1 }}
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={atLimit || !custom.trim()}
          style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 18px', color: MUTED, fontSize: 14, cursor: atLimit || !custom.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: atLimit || !custom.trim() ? 0.5 : 1 }}>
          add
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {TAG_GROUPS.map(group => (
          <div key={group.label}>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>
              {group.label} <span style={{ opacity: 0.6 }}>— {group.hint}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {group.tags.map(t => {
                const selected = value.includes(t);
                return (
                  <motion.button
                    key={t}
                    type="button"
                    whileHover={{ scale: selected || !atLimit ? 1.05 : 1 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => toggle(t)}
                    aria-pressed={selected}
                    style={{ ...pill(selected), opacity: !selected && atLimit ? 0.35 : 1, cursor: !selected && atLimit ? 'not-allowed' : 'pointer' }}>
                    {t}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ color: MUTED, fontSize: 12, marginTop: 14 }}>
        {value.length}/{MAX_TAGS} tags. Pick a few, make one up, skip it entirely — it&apos;s your profile.
      </div>
    </div>
  );
}
