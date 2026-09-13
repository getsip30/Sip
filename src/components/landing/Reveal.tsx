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
 * `className` and `style` exist because this wrapper becomes the grid item
 * wherever it wraps one, and the caller is the only one who knows that. A card
 * that needs to span two columns has to say so here: `grid-column` set on the
 * card inside does nothing, since the card's parent is this div. `style` is the
 * escape hatch for one-off values; `className` is how a caller reaches a rule
 * that needs a media query, which an inline style cannot express.
 */
export default function Reveal({
  children,
  delay = 0,
  y = 22,
  style,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 0.61, 0.36, 1] }}
      style={style}
      className={className}
    >
      {children}
    </motion.div>
  );
}
