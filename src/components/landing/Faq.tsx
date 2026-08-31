import { MUTED } from '@/lib/theme';
import Reveal from './Reveal';
import { MAX_PAGE_WIDTH, GUTTER, Eyebrow } from './shared';

/**
 * Common questions, rendered as real content.
 *
 * The landing page previously had no answer to any qualifying question a
 * visitor arrives with — most importantly "is this free", which is asked in
 * search constantly and which the page never once said. It also gave the site
 * almost no indexable body text: the hero and three step titles are headline
 * copy, not the kind of prose that can match a query.
 *
 * `items` is owned by page.tsx (the server component) and passed down, so the
 * same strings feed the FAQPage structured data and what a person reads. They
 * cannot drift apart, which is both a Google requirement and the only way this
 * stays honest.
 *
 * A plain Server Component, same reasoning as Steps: the only client code is
 * <Reveal>, and this file has no hooks of its own.
 */
export default function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      style={{ maxWidth: MAX_PAGE_WIDTH, margin: '0 auto', padding: `clamp(56px, 9vh, 100px) ${GUTTER}` }}
    >
      <Reveal>
        <Eyebrow>Common questions</Eyebrow>
        <h2
          id="faq-heading"
          style={{
            fontSize: 'clamp(30px, 4.4vw, 48px)',
            lineHeight: 1.06,
            letterSpacing: '-0.03em',
            fontWeight: 700,
            margin: '0 0 clamp(40px, 6vw, 64px)',
            maxWidth: 620,
          }}
        >
          Before you sign up.
        </h2>
      </Reveal>

      <div className="faq-grid">
        {items.map((item, i) => (
          <Reveal key={item.q} delay={Math.min(i, 3) * 0.05}>
            <h3 style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', margin: '0 0 10px' }}>
              {item.q}
            </h3>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: MUTED, margin: 0 }}>{item.a}</p>
          </Reveal>
        ))}
      </div>

      <style>{`
        .faq-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: clamp(28px, 4vw, 40px) clamp(32px, 5vw, 56px);
        }
        @media (min-width: 720px) {
          .faq-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>
    </section>
  );
}
