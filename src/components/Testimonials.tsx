import Reveal from '@/components/landing/Reveal';
import { Section, Eyebrow, wideCardIndices } from '@/components/landing/shared';
import styles from '@/components/landing/landing.module.css';

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  /** Profile the name links out to. Omitted when we do not have one. */
  link?: string;
};

/**
 * Quotes from people who have actually used Sip, in their own words.
 *
 * Kept apart from the landing page's "After the sip" section, which renders
 * seeker notes pulled from finished sessions. These are hand-collected and
 * static: they are the only social proof on the page before any mentor data
 * loads, so they must not depend on a fetch.
 *
 * A plain Server Component. It used to reach for framer-motion directly
 * (motion.div, motion.figure, useReducedMotion) to fade each card in on scroll,
 * which meant the whole file needed 'use client' for content that is otherwise
 * four hardcoded quotes. <Reveal> — the same client leaf Steps and Faq use —
 * now does that job, so this file ships no JS of its own.
 */
const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Conversations like these remind me how valuable it is to learn from people who have already walked the path you're just beginning.",
    name: 'Aafreen D',
    role: 'Student',
  },
  {
    quote:
      'Really enjoyed using Sip! It helped me connect with Hemit Patel, and our conversation gave me a lot of clarity on how to approach learning software development.',
    name: 'Aneesh Vasishta',
    role: 'Student',
    link: 'https://linkedin.com/in/aneesh-vasishta-708341363',
  },
  {
    quote: 'I had a wonderful time connecting with fellow aspiring engineers on Sip!',
    name: 'Hemit Patel',
    role: 'Mentor, Ex-SWE @ Miniswap (YC F25)',
    link: 'https://linkedin.com/in/hemitvpatel',
  },
  {
    quote: "Seeing this come to life really made me understand the impact of what you're building.",
    name: 'Tayyab',
    role: 'Early User',
  },
];

export default function Testimonials() {
  /*
   * Which cards run double width is computed from how many there are, not
   * hardcoded. It used to be `new Set([0, 3])`, which fills a three-column grid
   * only while there are exactly four testimonials — adding a fifth would have
   * left a hole in the last row with nothing to explain why. Add or remove
   * quotes above freely; the grid stays flush. The wide cards also set their
   * quote at display size, which is what keeps the row deliberately uneven
   * rather than four identical boxes.
   */
  const wide = wideCardIndices(TESTIMONIALS.length);

  return (
    <Section labelledBy="testimonials-heading" tone="gradient">
      <Reveal>
        <div style={{ marginBottom: 'clamp(52px, 7vw, 88px)' }}>
          <Eyebrow>Testimonials</Eyebrow>
          <h2 id="testimonials-heading" className={styles.headline}>
            What people are saying
          </h2>
        </div>
      </Reveal>

      <div className={styles.testimonialGrid}>
        {TESTIMONIALS.map((t, i) => {
          const isWide = wide.has(i);
          return (
            // The span and the stretch both go on the wrapper: it is the grid
            // item, so neither works from the card inside it.
            <Reveal
              key={t.name}
              delay={i * 0.07}
              style={{ display: 'flex' }}
              className={isWide ? styles.spanWide : undefined}
            >
              <figure className={`${styles.testimonialCard}${isWide ? ` ${styles.testimonialWide}` : ''}`}>
                <blockquote className={styles.testimonialQuote}>&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption className={styles.testimonialMeta}>
                  <span className={styles.testimonialName}>{t.name}</span>
                  <br />
                  {t.role}
                  {t.link && (
                    <>
                      {' · '}
                      <a
                        href={t.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.testimonialLink}
                      >
                        LinkedIn ↗
                      </a>
                    </>
                  )}
                </figcaption>
              </figure>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
