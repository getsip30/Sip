import type { Transition, Variants } from 'framer-motion';

/**
 * Shared motion tokens.
 *
 * The curve is the one the landing page already uses, so everything else lines
 * up with the part of the app that already felt right. Keeping easing and
 * duration in one place is what stops a panel here and a dropdown there from
 * each inventing their own timing.
 */
export const EASE = [0.22, 0.61, 0.36, 1] as const;

export const DUR = {
  /** Toggles and small state flips. Fast enough to feel immediate. */
  fast: 0.18,
  /** Panels, accordions, tab bodies. The default. */
  base: 0.28,
  /** Entrances covering real distance. */
  slow: 0.5,
} as const;

export const ease = (duration: number = DUR.base): Transition => ({ duration, ease: EASE });

/** Expanding and collapsing sections. Height is animated from measured auto. */
export const collapseVariants: Variants = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: 'auto', opacity: 1 },
};

export const collapseTransition: Transition = {
  height: { duration: DUR.base, ease: EASE },
  // Opacity trails height slightly so content does not appear before it has room.
  opacity: { duration: DUR.fast, ease: EASE },
};

/** Tab bodies and anything that swaps in place. */
export const swapVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

/** Counts and pills that pop in when they become non-zero. */
export const badgeVariants: Variants = {
  hidden: { scale: 0.6, opacity: 0 },
  visible: { scale: 1, opacity: 1 },
  exit: { scale: 0.6, opacity: 0 },
};

export const badgeTransition: Transition = { type: 'spring', stiffness: 520, damping: 30, mass: 0.6 };

/**
 * Staggered list entrance. Capped so a long list does not leave the last row
 * waiting seconds to appear.
 */
export const listItem = (index: number): Transition => ({
  duration: DUR.base,
  ease: EASE,
  delay: Math.min(index * 0.045, 0.3),
});
