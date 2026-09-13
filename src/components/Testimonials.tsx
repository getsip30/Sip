import Reveal from '@/components/landing/Reveal';
import { Section, Eyebrow } from '@/components/landing/shared';
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

/**
 * Cards 1 and 4 run double width, which fills a three-column grid exactly —
 * [1 1][2] / [3][4 4] — so the row is deliberately uneven with no empty cell
 * at the end. The wide ones also set their quote at display size.
 */
const WIDE = new Set([0, 3]);

export default function Testimonials() {
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
          const wide = WIDE.has(i);
          return (
            // The span and the stretch both go on the wrapper: it is the grid
            // item, so neither works from the card inside it.
            <Reveal
              key={t.name}
              delay={i * 0.07}
              style={{ display: 'flex' }}
              className={wide ? styles.spanWide : undefined}
            >
              <figure className={`${styles.testimonialCard}${wide ? ` ${styles.testimonialWide}` : ''}`}>
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
