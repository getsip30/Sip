import Reveal from './Reveal';
import { Section, Eyebrow } from './shared';
import styles from './landing.module.css';

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
 * Plain prose in a two-column grid, not an accordion: there are six short
 * answers and hiding them behind a click would undo the indexing this section
 * exists for.
 */
export default function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <Section id="faq" labelledBy="faq-heading" tone="base">
      <Reveal>
        <div style={{ marginBottom: 'clamp(52px, 7vw, 88px)' }}>
          <Eyebrow>Common questions</Eyebrow>
          <h2 id="faq-heading" className={styles.headline}>
            Before you sign up.
          </h2>
        </div>
      </Reveal>

      <div className={styles.faqGrid}>
        {items.map((item, i) => (
          <Reveal key={item.q} delay={Math.min(i, 3) * 0.05}>
            <h3 className={styles.faqQuestion}>{item.q}</h3>
            <p className={styles.faqAnswer}>{item.a}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
