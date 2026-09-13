import styles from './landing.module.css';

/**
 * Layout and typographic primitives shared across the landing page's sections.
 *
 * No hooks and no browser APIs, deliberately: this file is imported by both the
 * client sections (Landing.tsx) and the server ones (Steps, Faq, Testimonials),
 * and it has to stay safe for both without needing 'use client' itself.
 */

/** Background tone for a section. See the tone rules in landing.module.css. */
export type Tone = 'base' | 'raised' | 'gradient';

const TONE_CLASS: Record<Tone, string> = {
  base: styles.toneBase,
  raised: styles.toneRaised,
  gradient: styles.toneGradient,
};

/**
 * A page section: a full-bleed tone wrapper around a centred column.
 *
 * The two elements are not interchangeable. The tint has to be full-bleed, so
 * it belongs on the outer element; the max-width and gutters belong on the
 * inner one. Putting the tone on the centred column leaves the tint stopping at
 * its edges, which at most widths looks like a rendering bug.
 */
export function Section({
  children,
  id,
  labelledBy,
  tone = 'base',
}: {
  children: React.ReactNode;
  id?: string;
  /** id of the heading naming this section, for `aria-labelledby`. */
  labelledBy?: string;
  tone?: Tone;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`${styles.sectionOuter} ${TONE_CLASS[tone]}`}>
      <div className={styles.sectionInner}>{children}</div>
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
