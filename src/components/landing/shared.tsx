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

/**
 * Which cards in the three-column card grids should span two columns.
 *
 * A span-2 card cannot straddle a row boundary: if it does not fit in the
 * columns left on the current row, the browser pushes it to the next one and
 * leaves a visible hole behind it. So the spans have to divide the rows exactly,
 * and that depends on how many cards there are — which is why hardcoding the
 * positions (this was `new Set([0, 3])`, correct only for exactly four cards)
 * breaks the moment somebody adds or removes one.
 *
 * Every row is either [2,1] or [1,1,1], so `count + wide` has to be a multiple
 * of three. This takes the smallest number of wide cards that satisfies that,
 * and places them at 0, 2, 4… — the start of each [2,1] row, each consuming two
 * cards — so the wide rows are laid before the even ones and the grid always
 * ends flush.
 *
 *   3 or 6 cards -> none wide, plain rows
 *   4 cards      -> 0 and 2 wide  ([2,1] [2,1])
 *   5 cards      -> 0 wide        ([2,1] [1,1,1])
 *   7 cards      -> 0 and 2 wide  ([2,1] [2,1] [1,1,1])
 *
 * One card is the exception: it would need two wide cards to fill a row and
 * there is only one, so it is left alone in a short row. That is a gap the
 * grid cannot avoid, not a broken layout.
 *
 * Hardcoded to three columns because the [2,1] row shape is what makes the
 * arithmetic work; a four-column grid would need different packing. The spans
 * themselves only exist above 980px (see .spanWide), so narrower layouts are
 * unaffected either way.
 */
export function wideCardIndices(count: number): Set<number> {
  const remainder = count % 3;
  const needed = remainder === 0 ? 0 : 3 - remainder;
  const wide = Math.min(needed, Math.floor(count / 2));
  const indices = new Set<number>();
  for (let i = 0; i < wide; i++) indices.add(i * 2);
  return indices;
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
