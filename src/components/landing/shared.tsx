import styles from './landing.module.css';

/**
 * Layout and typographic primitives shared across the landing page's sections.
 *
 * No hooks and no browser APIs, deliberately: this file is imported by both the
 * client sections (Landing.tsx) and the server ones (Steps, Faq, Testimonials),
 * and it has to stay safe for both without needing 'use client' itself.
 *
 * The measurements these used to export as constants (MAX_PAGE_WIDTH, GUTTER)
 * are gone. Every section imported them to rebuild the same padding string in
 * its own inline style, which meant seven copies of one decision and no way to
 * express a breakpoint. They live in landing.module.css now, as .section.
 */

export function Section({
  children,
  id,
  labelledBy,
}: {
  children: React.ReactNode;
  id?: string;
  /** id of the heading naming this section, for `aria-labelledby`. */
  labelledBy?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={styles.section}>
      {children}
    </section>
  );
}

/**
 * The small uppercase label above every section headline.
 *
 * `color` is an override for the two places that set the label in the link blue
 * rather than muted grey; everything else takes the default.
 */
export function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div className={styles.eyebrow} style={color ? { color } : undefined}>
      {children}
    </div>
  );
}

export function Rule() {
  return <div className={styles.rule} />;
}

export function ArrowRight({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12h15M13 5.5 19.5 12 13 18.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
