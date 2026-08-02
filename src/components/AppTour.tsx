'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { BG, SURFACE, BORDER, TEXT, MUTED, ACCENT } from '@/lib/theme';

export type TourStep = {
  label: string;
  title: string;
  description: string;
  bullets?: string[];
  ctaHref?: string;
  ctaLabel?: string;
};

export default function AppTour({ steps, open, onClose }: { steps: TourStep[]; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  if (!open) return null;
  const step = steps[i];
  const last = i === steps.length - 1;

  function close() { setI(0); onClose(); }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={e => { if (e.target === e.currentTarget) close(); }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <motion.div key={i} initial={{ scale: 0.94, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0 }}
          role="dialog" aria-modal="true" aria-label="App tour"
          style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 20, padding: 28, width: '100%', maxWidth: 460 }}>

          <div style={{ display: 'flex', gap: 5, marginBottom: 22 }}>
            {steps.map((_, n) => (
              <div key={n} style={{ flex: 1, height: 3, borderRadius: 4, background: n <= i ? ACCENT : BORDER }} />
            ))}
          </div>

          <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '20px', display: 'flex', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: ACCENT, textTransform: 'uppercase' }}>{step.label}</div>
          </div>

          <h3 style={{ fontSize: 21, fontWeight: 700, marginBottom: 8 }}>{step.title}</h3>
          <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>{step.description}</p>
          {step.bullets && (
            <ul style={{ margin: '0 0 22px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {step.bullets.map(b => (
                <li key={b} style={{ display: 'flex', gap: 8, fontSize: 13.5, color: TEXT }}>
                  <span style={{ color: ACCENT }}>•</span>{b}
                </li>
              ))}
            </ul>
          )}

          {step.ctaHref && (
            <button onClick={() => { close(); router.push(step.ctaHref!); }}
              style={{ width: '100%', background: BG, border: `1px solid ${BORDER}`, color: ACCENT, padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 18 }}>
              {step.ctaLabel || 'Take me there →'}
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => setI(n => Math.max(0, n - 1))} disabled={i === 0}
              style={{ background: 'none', border: 'none', color: i === 0 ? '#484F58' : MUTED, fontSize: 13, cursor: i === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>← Back</button>
            <span style={{ color: MUTED, fontSize: 12 }}>{i + 1} / {steps.length}</span>
            <button onClick={() => last ? close() : setI(n => n + 1)}
              style={{ background: ACCENT, border: 'none', color: 'white', padding: '9px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {last ? 'Done' : 'Next →'}
            </button>
          </div>
          {!last && (
            <button onClick={close} style={{ display: 'block', margin: '14px auto 0', background: 'none', border: 'none', color: MUTED, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Skip tour</button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}