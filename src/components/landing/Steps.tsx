import Reveal from './Reveal';
import { Section, Eyebrow } from './shared';
import styles from './landing.module.css';

const STEPS = [
  {
    n: '01',
    title: 'Say what you’re stuck on',
    body: 'One sentence is enough. We read it against every mentor who is currently taking conversations, and rank who fits.',
  },
  {
    n: '02',
    title: 'See who can actually help',
    body: 'Real job, real company, and the specific topics they agreed to talk about. Profiles are short on purpose, so you can tell quickly.',
  },
  {
    n: '03',
    title: 'Have the conversation',
    body: 'Join a live room and take your place in the queue, or book a time that suits you both. Most first sips happen within the week.',
  },
];

/**
 * "How it works" — static prose with no dependency on auth, mentors, or notes.
 *
 * A plain Server Component: it renders through <Reveal>, a client leaf, so the
 * scroll-in animation survives, but this file itself has no hooks and ships no
 * JS of its own. It used to be a function nested inside the client-rendered
 * Landing.tsx, which meant its markup was bundled and hydrated along with
 * everything that section actually needs a browser for.
 */
export default function Steps() {
  return (
    <Section id="how-it-works" labelledBy="steps-heading">
      <Reveal>
        <div style={{ marginBottom: 'clamp(40px, 5.5vw, 64px)' }}>
          <Eyebrow>How it works</Eyebrow>
          <h2 id="steps-heading" className={styles.headline}>
            Three steps, no cold outreach.
          </h2>
        </div>
      </Reveal>

      {STEPS.map((s, i) => (
        <Reveal key={s.n} delay={i * 0.07}>
          <div className={styles.stepRow}>
            <div className={styles.stepNum}>{s.n}</div>
            <h3 className={styles.stepTitle}>{s.title}</h3>
            <p className={styles.stepBody}>{s.body}</p>
          </div>
        </Reveal>
      ))}
    </Section>
  );
}
