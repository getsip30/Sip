'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { SURFACE, TEXT, MUTED, LINK } from '@/lib/theme';

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

const MAX_PAGE_WIDTH = 1180;
const GUTTER = 'clamp(20px, 5vw, 56px)';

const mono: React.CSSProperties = {
  fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
};

export default function Testimonials() {
  const reduced = useReducedMotion();

  return (
    <section
      style={{ maxWidth: MAX_PAGE_WIDTH, margin: '0 auto', padding: `clamp(56px, 9vh, 100px) ${GUTTER}` }}
      aria-labelledby="testimonials-heading"
    >
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 22 }}
        whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-70px' }}
        transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
      >
        <div style={{ ...mono, fontSize: 11, color: MUTED, marginBottom: 20 }}>Testimonials</div>
        <h2
          id="testimonials-heading"
          style={{
            fontSize: 'clamp(28px, 4.2vw, 46px)',
            lineHeight: 1.06,
            letterSpacing: '-0.03em',
            fontWeight: 700,
            margin: '0 0 clamp(36px, 5vw, 58px)',
          }}
        >
          What people are saying
        </h2>
      </motion.div>

      <div className="testimonial-grid">
        {TESTIMONIALS.map((t, i) => (
          <motion.figure
            key={t.name}
            className="testimonial-card"
            initial={reduced ? false : { opacity: 0, y: 22 }}
            whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-70px' }}
            transition={{ duration: 0.6, delay: i * 0.07, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <blockquote
              style={{ fontSize: 15, lineHeight: 1.66, color: TEXT, margin: 0, textWrap: 'pretty' }}
            >
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <figcaption style={{ marginTop: 18, fontSize: 12.5, color: MUTED, lineHeight: 1.55 }}>
              <span style={{ color: TEXT, fontWeight: 600 }}>{t.name}</span>
              <br />
              {t.role}
              {t.link && (
                <>
                  {' · '}
                  <a
                    href={t.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: LINK, textDecoration: 'none' }}
                  >
                    LinkedIn ↗
                  </a>
                </>
              )}
            </figcaption>
          </motion.figure>
        ))}
      </div>

      <style>{`
        .testimonial-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 14px;
        }
        .testimonial-card {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          margin: 0;
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 16px;
          padding: 22px;
          background: ${SURFACE};
          transition: border-color 220ms ease, transform 220ms ease;
        }
        .testimonial-card:hover {
          border-color: rgba(112,181,249,0.4);
          transform: translateY(-3px);
        }
        @media (min-width: 720px) {
          .testimonial-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (min-width: 980px) {
          .testimonial-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }
      `}</style>
    </section>
  );
}
