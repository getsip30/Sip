'use client';

import { motion, useReducedMotion } from 'framer-motion';

/** Non-bouncing ease, shared by the enter and the leave. */
const EASE = [0.22, 0.61, 0.36, 1] as const;

/**
 * Fades and lifts children as they enter the viewport, and reverses when they
 * leave it.
 *
 * The one animation primitive every "reveal on scroll" section on the landing
 * page uses (Steps, Faq, Testimonials, MentorGrid, Proof, QuizPrompt,
 * FinalCta). Living in its own client file lets those sections stay plain,
 * server-rendered content that passes through a client leaf, rather than each
 * one needing 'use client' itself for a few lines of framer-motion.
 *
 * `once: false` is the whole point of the current behaviour. With `once: true`
 * each element animated in the first time it was seen and then stayed put
 * forever, so scrolling back up left everything already visible. Re-triggering
 * makes the reveal track scroll position in both directions, and because each
 * element watches its own intersection the order reverses for free: scrolling
 * down, step 01 enters before 02 before 03; scrolling up, 03 leaves the
 * viewport first, then 02, then 01.
 *
 * The leave is quicker than the enter and carries no delay. `delay` staggers
 * siblings that come into view together, but applying it on the way out would
 * make a reversal feel like lag rather than a response to scrolling.
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

  // No animation at all rather than a faster one: someone who has asked for
  // reduced motion should not get content that fades out again as they scroll.
  if (reduced) {
    return (
      <div style={style} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: false, margin: '-10% 0px -10% 0px' }}
      variants={{
        hidden: { opacity: 0, y, transition: { duration: 0.32, ease: EASE } },
        visible: { opacity: 1, y: 0, transition: { duration: 0.45, delay, ease: EASE } },
      }}
      style={style}
      className={className}
    >
      {children}
    </motion.div>
  );
}
