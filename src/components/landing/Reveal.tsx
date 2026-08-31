'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * Fades and lifts children the first time they enter the viewport.
 *
 * The one animation primitive every "reveal on scroll" section on the landing
 * page uses (Steps, Faq, Testimonials, MentorGrid, Proof, QuizPrompt,
 * FinalCta). Living in its own client file lets those sections stay plain,
 * server-rendered content that passes through a client leaf, rather than each
 * one needing 'use client' itself for a few lines of framer-motion.
 *
 * `style` is how a caller makes the animated wrapper participate correctly in
 * a CSS grid it wraps a grid item for — see MentorGrid and Testimonials, which
 * pass `{ display: 'flex' }` so the wrapper stretches like the card it wraps
 * would have on its own.
 */
export default function Reveal({
  children,
  delay = 0,
  y = 22,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  style?: React.CSSProperties;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 0.61, 0.36, 1] }}
      style={style}
    >
      {children}
    </motion.div>
  );
}
