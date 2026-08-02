'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { collapseVariants, collapseTransition } from '@/lib/motion';

/**
 * Animated show/hide for accordion and disclosure content.
 *
 * overflow:hidden is on the animating element rather than the caller, because a
 * height animation without it lets the content spill past the edge for the
 * duration of the transition, which is the exact snap-in this replaces.
 */
export default function Collapse({
  open,
  children,
  style,
}: {
  open: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="content"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={collapseVariants}
          transition={collapseTransition}
          style={{ overflow: 'hidden', ...style }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
